import { createAdminClient } from '@/lib/supabase/admin'
import {
  extractProjectNumberFromName,
  fetchContractLaborAccountId,
  fetchTransactions,
} from '../qbo-client'
import type { QBSettings } from '../types'

type QboRef = {
  value?: string
  name?: string
}

type QboContractLaborLine = {
  Id?: string
  Amount?: number | string
  Description?: string
  DetailType?: string
  AccountBasedExpenseLineDetail?: {
    AccountRef?: QboRef
    CustomerRef?: QboRef
  }
}

type QboExpense = {
  _entityType?: string
  Id?: string
  TxnDate?: string
  PrivateNote?: string
  Line?: QboContractLaborLine[]
  EntityRef?: QboRef
  VendorRef?: QboRef
  PayeeRef?: QboRef
  CustomerRef?: QboRef
  MetaData?: {
    LastUpdatedTime?: string
  }
}

type SubcontractContractRow = {
  id: number
  project_number: string | null
  vendor_name: string
  contract_number: string | null
  contract_type: 'fixed_monthly' | 'fixed_total' | 'hourly'
  monthly_amount: number | null
  original_amount: number | null
  start_date: string | null
  end_date: string | null
  phase_name: string | null
  description: string | null
  term_notes: string | null
  status: string
}

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function pickMatchingContractId(
  contracts: SubcontractContractRow[],
  input: {
    projectNumber: string | null
    vendorName: string
    expenseDate: string
    amount: number
    description: string | null
  }
) {
  if (!input.projectNumber) return null
  const inDateRange = (contract: SubcontractContractRow) => {
    if (contract.start_date && input.expenseDate < contract.start_date) return false
    if (contract.end_date && input.expenseDate > contract.end_date) return false
    return true
  }

  const candidates = contracts.filter((contract) => {
    if (normalize(contract.status) === 'cancelled') return false
    return (
      (contract.project_number || '').trim() === input.projectNumber &&
      normalize(contract.vendor_name) === normalize(input.vendorName) &&
      inDateRange(contract)
    )
  })
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0].id

  const profitShareCandidates = candidates.filter((contract) => {
    const haystack = [
      contract.phase_name,
      contract.description,
      contract.term_notes,
      contract.contract_number,
      input.description,
    ]
      .map((value) => normalize(value))
      .join(' ')
    return haystack.includes('profit share')
  })
  if (profitShareCandidates.length === 1) return profitShareCandidates[0].id

  const monthlyMatches = candidates.filter((contract) => {
    if (contract.contract_type !== 'fixed_monthly') return false
    const monthlyAmount = Number(contract.monthly_amount) || 0
    return Math.abs(monthlyAmount - input.amount) <= 0.01
  })
  if (monthlyMatches.length === 1) return monthlyMatches[0].id

  const hourlyMatches = candidates.filter((contract) => contract.contract_type === 'hourly')
  if (hourlyMatches.length === 1) return hourlyMatches[0].id

  const fixedTotalExactMatches = candidates.filter((contract) => {
    if (contract.contract_type !== 'fixed_total') return false
    return Math.abs((Number(contract.original_amount) || 0) - input.amount) <= 0.01
  })
  if (fixedTotalExactMatches.length === 1) return fixedTotalExactMatches[0].id

  return null
}

export async function syncContractLabor(
  supabase: ReturnType<typeof createAdminClient>,
  settings: QBSettings
) {
  const { data: projects } = await supabase.from('projects').select('id, project_number')
  const projectMap = new Map<string, number>()
  ;(projects as Array<{ id: number; project_number: string }> | null)?.forEach((project) => {
    const key = (project.project_number || '').trim()
    if (key) projectMap.set(key, project.id)
  })

  const { data: contracts } = await supabase
    .from('subcontract_contracts')
    .select(
      'id, project_number, vendor_name, contract_number, contract_type, monthly_amount, original_amount, start_date, end_date, phase_name, description, term_notes, status'
    )
  const contractRows = ((contracts as SubcontractContractRow[] | null) || [])

  // Use account ID matching so changes to AccountRef.name formatting do not break sync.
  const contractLaborAccountId = await fetchContractLaborAccountId(settings)

  const purchases = await fetchTransactions(settings, 'Purchase', null)
  const bills = await fetchTransactions(settings, 'Bill', null)
  const expenses = [...purchases, ...bills]

  let imported = 0
  let updated = 0
  const skipped = 0
  const pushed = 0
  let errors = 0
  const skippedDetails: Array<{
    qb_id: string
    qb_type: string
    vendor_name: string
    customer_name: string
    amount: number
    payment_date: string | null
    reason: string
  }> = []
  const syncTimestamp = new Date().toISOString()
  const seenQbKeys = new Set<string>()
  let totalRows = 0

  for (const expense of expenses) {
    try {
      const exp = expense as QboExpense
      const entityType = (exp._entityType as string) || 'Purchase'
      const qbId = exp.Id
      const qbKey = `${entityType}:${qbId}`
      const paymentDate = exp.TxnDate || null

      const lines = Array.isArray(exp.Line) ? exp.Line : []
      
      // FIX: Map with original indices BEFORE filtering to ensure stable source_line_id
      // This prevents duplicates when filtered results change order between syncs
      const contractLinesWithIndex = lines
        .map((line, originalIndex) => ({ line, originalIndex }))
        .filter(({ line }) => {
          if (line.DetailType !== 'AccountBasedExpenseLineDetail') return false
          const accountRef = line.AccountBasedExpenseLineDetail?.AccountRef || {}
          const accountRefValue = String(accountRef.value || '').trim()
          if (accountRefValue && accountRefValue === contractLaborAccountId) return true

          // Fallback for edge responses where ID is missing.
          const accountName = String(accountRef.name || '').trim().toLowerCase()
          return accountName === 'contract labor' || accountName.endsWith(':contract labor')
        })
      if (!contractLinesWithIndex.length) continue

      const vendorName =
        exp.EntityRef?.name || exp.VendorRef?.name || exp.PayeeRef?.name || 'Unknown'
      const qboUpdatedAt = exp.MetaData?.LastUpdatedTime || null
      const paymentDateIso = paymentDate || new Date().toISOString().slice(0, 10)
      const datePaid = entityType === 'Purchase' ? paymentDateIso : null

      for (const { line, originalIndex } of contractLinesWithIndex) {
        const amount = Number(line.Amount) || 0
        if (amount === 0) continue

        totalRows += 1
        const customerName =
          line.AccountBasedExpenseLineDetail?.CustomerRef?.name ||
          exp.CustomerRef?.name ||
          ''
        const projectNumber = extractProjectNumberFromName(customerName)
        const projectId = projectNumber ? projectMap.get(projectNumber) || null : null
        const description =
          line.Description || (exp.PrivateNote as string | undefined) || null
        const subcontractContractId = pickMatchingContractId(contractRows, {
          projectNumber,
          vendorName,
          expenseDate: paymentDateIso,
          amount,
          description,
        })
        const lineIdValue = String(line.Id || '').trim()
        // FIX: Use ORIGINAL array index, not filtered index, for stable line ID
        const sourceLineId = lineIdValue || `line_${originalIndex + 1}`
        const seenKey = `${qbKey}::${sourceLineId}`

        seenQbKeys.add(seenKey)

        const { data: existing, error: existingError } = await supabase
          .from('project_expenses')
          .select('id, subcontract_contract_id')
          .eq('source_system', 'qbo')
          .eq('source_entity_type', 'contract_labor')
          .eq('source_entity_id', qbKey)
          .eq('source_line_id', sourceLineId)
          .maybeSingle()

        if (existingError) {
          errors++
          continue
        }

        const payload = {
          source_system: 'qbo',
          source_entity_type: 'contract_labor',
          source_entity_id: qbKey,
          source_line_id: sourceLineId,
          project_id: projectId,
          project_number: projectNumber,
          vendor_name: vendorName,
          expense_date: paymentDateIso,
          date_paid: datePaid,
          description,
          category_name: 'Contract Labor',
          sub_category_name: null,
          fee_amount: amount,
          subcontract_contract_id: subcontractContractId || (existing as { subcontract_contract_id?: number | null } | null)?.subcontract_contract_id || null,
          is_reimbursable: false,
          billing_status: 'ignored',
          status: 'not_reimbursable',
          source_active: true,
          source_closed_at: null,
          source_close_reason: null,
          qbo_last_updated_at: qboUpdatedAt,
          last_synced_at: syncTimestamp,
          updated_at: qboUpdatedAt || syncTimestamp,
        }

        if (existing) {
          const { error } = await supabase
            .from('project_expenses')
            .update(payload as never)
            .eq('id', (existing as { id: number }).id as never)
          if (error) errors++
          else updated++
        } else {
          const { error } = await supabase.from('project_expenses').insert(payload as never)
          if (error) errors++
          else imported++
        }
      }
    } catch (err) {
      console.error('Error syncing contract labor expense:', err)
      errors++
    }
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('project_expenses')
    .select('id, source_entity_id, source_line_id')
    .eq('source_system', 'qbo')
    .eq('source_entity_type', 'contract_labor')
    .is('source_active', true)
  const existingRowsTyped = (existingRows || []) as Array<{
    id: number
    source_entity_id: string | null
    source_line_id: string | null
  }>
  if (existingError) {
    errors++
  } else if (existingRowsTyped.length) {
    const idsToDelete = existingRowsTyped
      .filter((row) => {
        const sourceEntityId = (row.source_entity_id || '').trim()
        const sourceLineId = (row.source_line_id || '').trim()
        if (!sourceEntityId || !sourceLineId) return false
        return !seenQbKeys.has(`${sourceEntityId}::${sourceLineId}`)
      })
      .map((row) => row.id)
    const batchSize = 100
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize)
      const { error } = await supabase
        .from('project_expenses')
        .update({
          source_active: false,
          source_closed_at: syncTimestamp,
          source_close_reason: 'removed_in_qbo',
          updated_at: syncTimestamp,
          last_synced_at: syncTimestamp,
        } as never)
        .in('id', batch as never)
      if (error) errors++
    }
  }

  return {
    imported,
    updated,
    skipped,
    pushed,
    errors,
    total: totalRows,
    skippedDetails: skippedDetails.slice(0, 20),
  }
}
