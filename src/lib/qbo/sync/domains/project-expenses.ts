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

type QboExpenseLine = {
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
  Line?: QboExpenseLine[]
  EntityRef?: QboRef
  VendorRef?: QboRef
  PayeeRef?: QboRef
  CustomerRef?: QboRef
  MetaData?: {
    LastUpdatedTime?: string
  }
}

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

export async function syncProjectExpenses(
  supabase: ReturnType<typeof createAdminClient>,
  settings: QBSettings
) {
  const { data: projects } = await supabase.from('projects').select('id, project_number')
  const projectMap = new Map<string, number>()
  ;(projects as Array<{ id: number; project_number: string }> | null)?.forEach((project) => {
    const key = (project.project_number || '').trim()
    if (key) projectMap.set(key, project.id)
  })

  const contractLaborAccountId = await fetchContractLaborAccountId(settings)
  const purchases = await fetchTransactions(settings, 'Purchase', null)
  const bills = await fetchTransactions(settings, 'Bill', null)
  const expenses = [...purchases, ...bills]

  let imported = 0
  let updated = 0
  const skipped = 0
  const pushed = 0
  let errors = 0
  const syncTimestamp = new Date().toISOString()
  const seenQbKeys = new Set<string>()
  let totalRows = 0

  for (const expense of expenses) {
    try {
      const exp = expense as QboExpense
      const entityType = (exp._entityType as string) || 'Purchase'
      const qbId = exp.Id
      if (!qbId) continue
      const qbKey = `${entityType}:${qbId}`
      const expenseDate = exp.TxnDate || new Date().toISOString().slice(0, 10)
      const isPurchaseLike = entityType === 'Purchase'
      const datePaid = isPurchaseLike ? expenseDate : null

      const lines = Array.isArray(exp.Line) ? exp.Line : []
      
      // FIX: Map with original indices BEFORE filtering to ensure stable source_line_id
      // This prevents duplicates when filtered results change order between syncs
      const projectExpenseLinesWithIndex = lines
        .map((line, originalIndex) => ({ line, originalIndex }))
        .filter(({ line }) => {
          if (line.DetailType !== 'AccountBasedExpenseLineDetail') return false

          const accountRef = line.AccountBasedExpenseLineDetail?.AccountRef || {}
          const accountRefValue = String(accountRef.value || '').trim()
          const accountName = normalize(accountRef.name)
          const isContractLaborAccount =
            (accountRefValue && accountRefValue === contractLaborAccountId) ||
            accountName === 'contract labor' ||
            accountName.endsWith(':contract labor')
          if (isContractLaborAccount) return false

          const customerName =
            line.AccountBasedExpenseLineDetail?.CustomerRef?.name ||
            exp.CustomerRef?.name ||
            ''
          const projectNumber = extractProjectNumberFromName(customerName)
          return Boolean(projectNumber)
        })

      if (!projectExpenseLinesWithIndex.length) continue

      const vendorName =
        exp.EntityRef?.name || exp.VendorRef?.name || exp.PayeeRef?.name || 'Unknown'
      const qboUpdatedAt = exp.MetaData?.LastUpdatedTime || null

      for (const { line, originalIndex } of projectExpenseLinesWithIndex) {
        const amount = Number(line.Amount) || 0
        if (amount === 0) continue

        const customerName =
          line.AccountBasedExpenseLineDetail?.CustomerRef?.name ||
          exp.CustomerRef?.name ||
          ''
        const projectNumber = extractProjectNumberFromName(customerName)
        if (!projectNumber) continue

        totalRows += 1
        const projectId = projectMap.get(projectNumber) || null
        const description = line.Description || (exp.PrivateNote as string | undefined) || null
        const lineIdValue = String(line.Id || '').trim()
        // FIX: Use ORIGINAL array index, not filtered index, for stable line ID
        const sourceLineId = lineIdValue || `line_${originalIndex + 1}`
        const seenKey = `${qbKey}::${sourceLineId}`
        seenQbKeys.add(seenKey)

        const accountNameRaw = (line.AccountBasedExpenseLineDetail?.AccountRef?.name || '').trim()
        const accountParts = accountNameRaw.split(':').map((part) => part.trim()).filter(Boolean)
        const categoryName = accountParts[0] || accountNameRaw || 'Expense'
        const subCategoryName = accountParts.length > 1 ? accountParts.slice(1).join(' : ') : null

        const { data: existing, error: existingError } = await supabase
          .from('project_expenses')
          .select('id, is_reimbursable, status, billing_status, invoice_id, invoice_number, date_invoiced, markup_pct')
          .eq('source_system', 'qbo')
          .eq('source_entity_type', 'project_expense')
          .eq('source_entity_id', qbKey)
          .eq('source_line_id', sourceLineId)
          .maybeSingle()

        if (existingError) {
          errors++
          continue
        }

        const basePayload = {
          source_system: 'qbo',
          source_entity_type: 'project_expense',
          source_entity_id: qbKey,
          source_line_id: sourceLineId,
          project_id: projectId,
          project_number: projectNumber,
          vendor_name: vendorName,
          expense_date: expenseDate,
          date_paid: datePaid,
          description,
          category_name: categoryName,
          sub_category_name: subCategoryName,
          fee_amount: amount,
          source_active: true,
          source_closed_at: null,
          source_close_reason: null,
          qbo_last_updated_at: qboUpdatedAt,
          last_synced_at: syncTimestamp,
          updated_at: qboUpdatedAt || syncTimestamp,
        }

        if (existing) {
          const existingTyped = existing as {
            id: number
            is_reimbursable: boolean | null
            status: string | null
            billing_status: string | null
            invoice_id: number | null
            invoice_number: string | null
            date_invoiced: string | null
            markup_pct: number | null
          }
          const { error } = await supabase
            .from('project_expenses')
            .update({
              ...basePayload,
              // Preserve user billing decisions and invoice links.
              is_reimbursable: existingTyped.is_reimbursable ?? false,
              status: existingTyped.status || 'pending',
              billing_status: existingTyped.billing_status || 'pending',
              invoice_id: existingTyped.invoice_id,
              invoice_number: existingTyped.invoice_number,
              date_invoiced: existingTyped.date_invoiced,
              markup_pct: existingTyped.markup_pct ?? 0.15,
            } as never)
            .eq('id', existingTyped.id as never)
          if (error) errors++
          else updated++
        } else {
          const { error } = await supabase.from('project_expenses').insert({
            ...basePayload,
            is_reimbursable: false,
            status: 'pending',
            billing_status: 'pending',
            markup_pct: 0.15,
          } as never)
          if (error) errors++
          else imported++
        }
      }
    } catch (err) {
      console.error('Error syncing project expense:', err)
      errors++
    }
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('project_expenses')
    .select('id, source_entity_id, source_line_id')
    .eq('source_system', 'qbo')
    .eq('source_entity_type', 'project_expense')
    .is('source_active', true)
  const existingRowsTyped = (existingRows || []) as Array<{
    id: number
    source_entity_id: string | null
    source_line_id: string | null
  }>

  if (existingError) {
    errors++
  } else if (existingRowsTyped.length) {
    const idsToDeactivate = existingRowsTyped
      .filter((row) => {
        const sourceEntityId = (row.source_entity_id || '').trim()
        const sourceLineId = (row.source_line_id || '').trim()
        if (!sourceEntityId || !sourceLineId) return false
        return !seenQbKeys.has(`${sourceEntityId}::${sourceLineId}`)
      })
      .map((row) => row.id)

    const batchSize = 100
    for (let i = 0; i < idsToDeactivate.length; i += batchSize) {
      const batch = idsToDeactivate.slice(i, i + batchSize)
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
    skippedDetails: [],
  }
}

