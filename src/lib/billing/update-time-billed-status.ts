/**
 * Update time entry billed status based on invoice billing periods
 * 
 * Logic: Once an invoice goes out for a billing period, all time entries
 * from that period should be marked as billed.
 * 
 * Example: March invoice covers February time → mark all Feb time as billed
 */

import { createAdminClient } from '@/lib/supabase/admin'

export async function updateTimeBilledStatus() {
  const supabase = createAdminClient()
  
  console.log('🔄 Updating time entry billed status based on invoices...')
  
  // Get all invoices with their billing periods
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('billing_period, date_issued')
    .not('billing_period', 'is', null)
    .order('billing_period')
  
  if (invoicesError) {
    console.error('❌ Error fetching invoices:', invoicesError)
    throw invoicesError
  }
  
  if (!invoices || invoices.length === 0) {
    console.log('⚠️  No invoices found with billing periods')
    return { updated: 0, message: 'No invoices to process' }
  }
  
  // Get unique billing periods that have been invoiced
  const billedPeriods = new Set(
    invoices
      .filter(inv => inv.billing_period)
      .map(inv => inv.billing_period)
  )
  
  console.log(`📅 Found ${billedPeriods.size} billed periods:`, Array.from(billedPeriods).sort())
  
  let totalUpdated = 0
  
  // For each billed period, mark all time entries as billed
  for (const period of billedPeriods) {
    const { data: updated, error: updateError } = await supabase
      .from('time_entries')
      .update({ is_billed: true })
      .eq('billing_period', period)
      .eq('is_billed', false) // Only update unbilled entries
      .select('id')
    
    if (updateError) {
      console.error(`❌ Error updating period ${period}:`, updateError)
      continue
    }
    
    const count = updated?.length || 0
    if (count > 0) {
      console.log(`  ✅ ${period}: Marked ${count} time entries as billed`)
      totalUpdated += count
    }
  }
  
  console.log(`\n✅ Total: Marked ${totalUpdated} time entries as billed`)
  
  return {
    updated: totalUpdated,
    billedPeriods: Array.from(billedPeriods).sort(),
    message: `Successfully updated ${totalUpdated} time entries`
  }
}

/**
 * Get summary of billed vs unbilled time entries
 */
export async function getTimeBillingSummary() {
  const supabase = createAdminClient()
  
  const { data: summary, error } = await supabase
    .rpc('get_time_billing_summary')
    .single()
  
  if (error) {
    // If RPC doesn't exist, fall back to manual query
    const { data: allEntries } = await supabase
      .from('time_entries')
      .select('is_billed, hours')
    
    const billed = allEntries?.filter(e => e.is_billed) || []
    const unbilled = allEntries?.filter(e => !e.is_billed) || []
    
    return {
      total_entries: allEntries?.length || 0,
      billed_entries: billed.length,
      unbilled_entries: unbilled.length,
      billed_hours: billed.reduce((sum, e) => sum + (e.hours || 0), 0),
      unbilled_hours: unbilled.reduce((sum, e) => sum + (e.hours || 0), 0)
    }
  }
  
  return summary
}
