import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const QB_CLIENT_ID = process.env.QB_CLIENT_ID
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !QB_CLIENT_ID || !QB_CLIENT_SECRET) {
  throw new Error('Missing required environment variables (Supabase or QuickBooks credentials).')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function parseAmount(value) {
  if (!value) return 0
  const cleaned = String(value).replace(/[$,\s]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function firstValue(colData, index) {
  return String(colData?.[index]?.value || '').trim()
}

function flattenRows(rows, options) {
  if (!rows?.length) return []
  const lines = []
  for (const row of rows) {
    const headerTitle = firstValue(row?.Header?.ColData, 0) || null
    const nextSection = options.section || headerTitle
    const nextParentKey = headerTitle || options.parentKey

    if (row?.ColData?.length) {
      const accountName = firstValue(row.ColData, 0)
      if (accountName) {
        options.sortState.value += 1
        lines.push({
          section: nextSection,
          account_name: accountName,
          account_ref: row.ColData?.[0]?.id || null,
          amount: parseAmount(firstValue(row.ColData, 1)),
          sort_order: options.sortState.value,
          depth: options.depth,
          is_total: accountName.toLowerCase().startsWith('total '),
          parent_key: options.parentKey,
          row_key: accountName,
        })
      }
    }

    if (row?.Summary?.ColData?.length) {
      const summaryName = firstValue(row.Summary.ColData, 0)
      if (summaryName) {
        options.sortState.value += 1
        lines.push({
          section: nextSection,
          account_name: summaryName,
          account_ref: row.Summary.ColData?.[0]?.id || null,
          amount: parseAmount(firstValue(row.Summary.ColData, 1)),
          sort_order: options.sortState.value,
          depth: options.depth,
          is_total: true,
          parent_key: nextParentKey,
          row_key: summaryName,
        })
      }
    }

    if (row?.Rows?.Row?.length) {
      lines.push(
        ...flattenRows(row.Rows.Row, {
          section: nextSection,
          depth: options.depth + 1,
          parentKey: nextParentKey,
          sortState: options.sortState,
        })
      )
    }
  }
  return lines
}

async function getQBSettings() {
  const { data, error } = await supabase.from('qb_settings').select('*').single()
  if (error || !data) throw error || new Error('QuickBooks not connected')
  return data
}

async function refreshTokenIfNeeded(settings) {
  const expiresAt = new Date(settings.token_expires_at || 0)
  const now = new Date()
  if (expiresAt.getTime() - now.getTime() >= 5 * 60 * 1000) return settings

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: settings.refresh_token,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to refresh QB token: ${response.status} ${text}`)
  }

  const tokens = await response.json()
  const newExpiresAt = new Date()
  newExpiresAt.setSeconds(newExpiresAt.getSeconds() + Number(tokens.expires_in || 3600))

  const { error: updateError } = await supabase
    .from('qb_settings')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', settings.id)
  if (updateError) throw updateError

  return { ...settings, access_token: tokens.access_token, refresh_token: tokens.refresh_token }
}

async function fetchQBOReport(settings, reportType, periodStart, periodEnd, basis) {
  const isPL = reportType === 'profit_and_loss'
  const reportPath = isPL ? 'ProfitAndLoss' : 'BalanceSheet'
  const params = new URLSearchParams({
    accounting_method: basis === 'cash' ? 'Cash' : 'Accrual',
    minorversion: '70',
  })

  if (isPL) {
    params.set('start_date', periodStart)
    params.set('end_date', periodEnd)
  } else {
    params.set('start_date', periodStart)
    params.set('end_date', periodEnd)
  }

  const url = `https://quickbooks.api.intuit.com/v3/company/${settings.realm_id}/reports/${reportPath}?${params.toString()}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${settings.access_token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${reportPath} API ${response.status}: ${text}`)
  }

  const payload = await response.json()

  if (!isPL) {
    const headerEndPeriod = String(payload?.Header?.EndPeriod || '').slice(0, 10)
    if (headerEndPeriod && headerEndPeriod !== periodEnd) {
      throw new Error(
        `BalanceSheet EndPeriod mismatch: expected ${periodEnd}, got ${headerEndPeriod}`
      )
    }
  }

  return payload
}

async function persistSnapshot(reportType, periodStart, periodEnd, basis, payload) {
  const rows = (payload?.Rows?.Row || [])
  const lines = flattenRows(rows, {
    section: null,
    depth: 1,
    parentKey: null,
    sortState: { value: 0 },
  }).filter((line) => line.account_name)

  const { data: snapshot, error: snapError } = await supabase
    .from('accounting_snapshots')
    .insert({
      report_type: reportType,
      period_start: periodStart,
      period_end: periodEnd,
      basis,
      raw_payload: payload,
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (snapError || !snapshot) throw snapError || new Error('Failed to insert snapshot')

  if (lines.length > 0) {
    const payloadLines = lines.map((line) => ({ snapshot_id: snapshot.id, ...line }))
    const { error: lineError } = await supabase.from('accounting_snapshot_lines').insert(payloadLines)
    if (lineError) throw lineError
  }

  return { snapshotId: snapshot.id, lineCount: lines.length }
}

async function main() {
  console.log('Loading existing snapshot combinations...')
  const { data: combos, error: comboError } = await supabase
    .from('accounting_snapshots')
    .select('report_type, period_start, period_end, basis')
    .in('report_type', ['profit_and_loss', 'balance_sheet'])
    .order('report_type', { ascending: true })
    .order('period_start', { ascending: true })
  if (comboError) throw comboError

  const deduped = new Map()
  for (const row of combos || []) {
    const key = `${row.report_type}::${row.period_start}::${row.period_end}::${row.basis}`
    if (!deduped.has(key)) deduped.set(key, row)
  }
  const tasks = Array.from(deduped.values())
  console.log(`Found ${tasks.length} snapshot combinations to refresh.`)

  let settings = await getQBSettings()
  let success = 0
  let failed = 0
  const failures = []

  for (let i = 0; i < tasks.length; i += 1) {
    const task = tasks[i]
    try {
      settings = await refreshTokenIfNeeded(settings)
      const payload = await fetchQBOReport(
        settings,
        task.report_type,
        task.period_start,
        task.period_end,
        task.basis
      )
      const persisted = await persistSnapshot(
        task.report_type,
        task.period_start,
        task.period_end,
        task.basis,
        payload
      )
      success += 1
      console.log(
        `[${i + 1}/${tasks.length}] OK ${task.report_type} ${task.basis} ${task.period_start}..${task.period_end} -> snapshot ${persisted.snapshotId} (${persisted.lineCount} lines)`
      )
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      failures.push({
        report_type: task.report_type,
        basis: task.basis,
        period_start: task.period_start,
        period_end: task.period_end,
        error: message,
      })
      console.error(
        `[${i + 1}/${tasks.length}] FAIL ${task.report_type} ${task.basis} ${task.period_start}..${task.period_end}: ${message}`
      )
    }
  }

  console.log('---')
  console.log(`Refresh complete. Success: ${success}, Failed: ${failed}`)
  if (failures.length > 0) {
    console.log('Failures:')
    for (const failure of failures) {
      console.log(
        `- ${failure.report_type} ${failure.basis} ${failure.period_start}..${failure.period_end}: ${failure.error}`
      )
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Fatal error: ${message}`)
  process.exit(1)
})

