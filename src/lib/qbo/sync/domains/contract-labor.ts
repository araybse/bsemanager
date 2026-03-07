import { createAdminClient } from '@/lib/supabase/admin'
import {
  extractProjectNumberFromName,
  fetchContractLaborAccountId,
  fetchTransactions,
} from '../qbo-client'
import type { QBSettings } from '../types'

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

  for (const expense of expenses) {
    try {
      const exp = expense as Record<string, any>
      const entityType = (exp._entityType as string) || 'Purchase'
      const qbId = exp.Id
      const qbKey = `${entityType}:${qbId}`
      const paymentDate = exp.TxnDate || null

      const lines = Array.isArray(exp.Line) ? exp.Line : []
      const contractLines = lines.filter((line) => {
        if (line.DetailType !== 'AccountBasedExpenseLineDetail') return false
        const accountRef = line.AccountBasedExpenseLineDetail?.AccountRef || {}
        const accountRefValue = String(accountRef.value || '').trim()
        if (accountRefValue && accountRefValue === contractLaborAccountId) return true

        // Fallback for edge responses where ID is missing.
        const accountName = String(accountRef.name || '').trim().toLowerCase()
        return accountName === 'contract labor' || accountName.endsWith(':contract labor')
      })
      if (!contractLines.length) continue

      const amount = contractLines.reduce((sum, line) => sum + (Number(line.Amount) || 0), 0)
      const description =
        contractLines.find((line) => line.Description)?.Description ||
        (exp.PrivateNote as string | undefined) ||
        null
      const vendorName =
        exp.EntityRef?.name || exp.VendorRef?.name || exp.PayeeRef?.name || 'Unknown'
      const customerName =
        contractLines.find((line) => line.AccountBasedExpenseLineDetail?.CustomerRef?.name)
          ?.AccountBasedExpenseLineDetail?.CustomerRef?.name ||
        exp.CustomerRef?.name ||
        ''

      const projectNumber = extractProjectNumberFromName(customerName)
      const projectId = projectNumber ? projectMap.get(projectNumber) || null : null
      const qboUpdatedAt = exp.MetaData?.LastUpdatedTime || null
      const paymentDateValue = paymentDate ? new Date(paymentDate) : new Date()
      const year = paymentDateValue.getUTCFullYear()
      const month = paymentDateValue.getUTCMonth() + 1

      const { data: existing } = await supabase
        .from('contract_labor')
        .select('id, updated_at, last_synced_at')
        .eq('qb_expense_id' as never, qbKey as never)
        .maybeSingle()

      const payload = {
        project_id: projectId,
        project_number: projectNumber,
        vendor_name: vendorName,
        description,
        amount,
        payment_date: paymentDate || paymentDateValue.toISOString().slice(0, 10),
        year,
        month,
        qb_expense_id: qbKey,
        last_synced_at: syncTimestamp,
        updated_at: qboUpdatedAt || syncTimestamp,
      }

      seenQbKeys.add(qbKey)

      if (existing) {
        const { error } = await supabase
          .from('contract_labor')
          .update(payload as never)
          .eq('id' as never, (existing as { id: number }).id as never)
        if (error) errors++
        else updated++
      } else {
        const { error } = await supabase.from('contract_labor').insert(payload as never)
        if (error) errors++
        else imported++
      }
    } catch (err) {
      console.error('Error syncing contract labor expense:', err)
      errors++
    }
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('contract_labor')
    .select('id, qb_expense_id')
    .not('qb_expense_id', 'is', null)
  const existingRowsTyped = (existingRows || []) as Array<{ id: number; qb_expense_id: string | null }>
  if (existingError) {
    errors++
  } else if (existingRowsTyped.length) {
    const idsToDelete = existingRowsTyped
      .filter((row) => row.qb_expense_id && !seenQbKeys.has(row.qb_expense_id))
      .map((row) => row.id)
    const batchSize = 100
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize)
      const { error } = await supabase.from('contract_labor').delete().in('id', batch as never)
      if (error) errors++
    }
  }

  return {
    imported,
    updated,
    skipped,
    pushed,
    errors,
    total: expenses.length,
    skippedDetails: skippedDetails.slice(0, 20),
  }
}
