/**
 * Update Time Entry Billed Status
 * 
 * Marks time entries as billed when an invoice is created that covers their billing period.
 * This runs after invoice sync to maintain accurate billing status.
 * 
 * Logic:
 * - Find all time entries for the invoice's project and billing period
 * - Mark them as is_billed = true
 * - Only updates unbilled entries (idempotent)
 */

import { createClient } from '@/lib/supabase/server'

export interface UpdateTimeBilledStatusParams {
  projectId: number
  billingPeriod: string // ISO date (YYYY-MM-DD) - first day of month
  invoiceId: number
}

export interface UpdateTimeBilledStatusResult {
  success: boolean
  entriesUpdated: number
  error?: string
}

/**
 * Mark time entries as billed for a specific project and billing period
 */
export async function updateTimeBilledStatus(
  params: UpdateTimeBilledStatusParams
): Promise<UpdateTimeBilledStatusResult> {
  const supabase = await createClient()
  const { projectId, billingPeriod, invoiceId } = params

  try {
    // Get all unbilled time entries for this project and billing period
    type TimeEntry = { id: number }
    const { data: timeEntries, error: fetchError } = await supabase
      .from('time_entries')
      .select('id')
      .eq('project_id', projectId)
      .eq('billing_period', billingPeriod)
      .eq('is_billed', false)

    if (fetchError) {
      console.error('[Billing Status] Failed to fetch time entries:', fetchError)
      return {
        success: false,
        entriesUpdated: 0,
        error: fetchError.message
      }
    }

    if (!timeEntries || timeEntries.length === 0) {
      return {
        success: true,
        entriesUpdated: 0
      }
    }

    const entryIds = (timeEntries as TimeEntry[]).map(e => e.id)

    // Update all entries to billed
    const { error: updateError } = await supabase
      .from('time_entries')
      .update({ 
        is_billed: true
      } as never)
      .in('id', entryIds as never)

    if (updateError) {
      console.error('[Billing Status] Failed to update time entries:', updateError)
      return {
        success: false,
        entriesUpdated: 0,
        error: updateError.message
      }
    }

    return {
      success: true,
      entriesUpdated: entryIds.length
    }
  } catch (err) {
    const error = err as Error
    console.error('[Billing Status] Unexpected error:', error)
    return {
      success: false,
      entriesUpdated: 0,
      error: error.message
    }
  }
}

/**
 * Batch update for multiple invoices (useful for backfill)
 */
export async function updateTimeBilledStatusBatch(
  invoices: Array<{ projectId: number; billingPeriod: string; invoiceId: number }>
): Promise<{ total: number; updated: number; failed: number }> {
  let updated = 0
  let failed = 0

  for (const invoice of invoices) {
    const result = await updateTimeBilledStatus(invoice)
    if (result.success) {
      updated += result.entriesUpdated
    } else {
      failed++
    }
  }

  return {
    total: invoices.length,
    updated,
    failed
  }
}

/**
 * Backfill billing status for all existing invoices
 * Run this once to mark historical time entries as billed
 */
export async function backfillTimeBilledStatus(): Promise<{
  success: boolean
  invoicesProcessed: number
  entriesUpdated: number
  errors: string[]
}> {
  const supabase = await createClient()
  const errors: string[] = []
  let entriesUpdated = 0

  try {
    // Get all invoices with their project and billing period
    type Invoice = { id: number; project_id: number; billing_period: string | null }
    const { data: invoices, error: fetchError } = await supabase
      .from('invoices')
      .select('id, project_id, billing_period')
      .not('billing_period', 'is', null)
      .order('billing_period')

    if (fetchError) {
      errors.push(`Failed to fetch invoices: ${fetchError.message}`)
      return {
        success: false,
        invoicesProcessed: 0,
        entriesUpdated: 0,
        errors
      }
    }

    if (!invoices || invoices.length === 0) {
      return {
        success: true,
        invoicesProcessed: 0,
        entriesUpdated: 0,
        errors: []
      }
    }

    for (const invoice of (invoices as Invoice[])) {
      const result = await updateTimeBilledStatus({
        projectId: invoice.project_id,
        billingPeriod: invoice.billing_period!,
        invoiceId: invoice.id
      })

      if (result.success) {
        entriesUpdated += result.entriesUpdated
      } else {
        errors.push(`Invoice ${invoice.id}: ${result.error}`)
      }
    }

    return {
      success: true,
      invoicesProcessed: invoices.length,
      entriesUpdated,
      errors
    }
  } catch (err) {
    const error = err as Error
    errors.push(`Unexpected error: ${error.message}`)
    return {
      success: false,
      invoicesProcessed: 0,
      entriesUpdated: 0,
      errors
    }
  }
}
