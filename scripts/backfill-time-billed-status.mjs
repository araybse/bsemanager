/**
 * Backfill Time Entry Billed Status
 * 
 * One-time script to mark historical time entries as billed based on existing invoices.
 * Run this after deploying the billing status feature.
 * 
 * Usage:
 *   node scripts/backfill-time-billed-status.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function backfillTimeBilledStatus() {
  console.log('🔄 Starting backfill of time entry billed status...\n')

  try {
    // Get all invoices with billing periods
    const { data: invoices, error: fetchError } = await supabase
      .from('invoices')
      .select('id, project_id, billing_period, invoice_number')
      .not('billing_period', 'is', null)
      .order('billing_period')

    if (fetchError) {
      throw new Error(`Failed to fetch invoices: ${fetchError.message}`)
    }

    if (!invoices || invoices.length === 0) {
      console.log('ℹ️  No invoices found with billing periods')
      return
    }

    console.log(`📋 Found ${invoices.length} invoices to process\n`)

    let totalEntriesUpdated = 0
    let invoicesProcessed = 0
    let errors = 0

    for (const invoice of invoices) {
      try {
        // Find unbilled time entries for this project and billing period
        const { data: timeEntries, error: timeError } = await supabase
          .from('time_entries')
          .select('id')
          .eq('project_id', invoice.project_id)
          .eq('billing_period', invoice.billing_period)
          .eq('is_billed', false)

        if (timeError) {
          console.error(`   ❌ Error fetching time entries for invoice ${invoice.invoice_number}:`, timeError.message)
          errors++
          continue
        }

        if (!timeEntries || timeEntries.length === 0) {
          // No unbilled entries - already processed or no time for this period
          invoicesProcessed++
          continue
        }

        const entryIds = timeEntries.map(e => e.id)

        // Update entries to billed
        const { error: updateError } = await supabase
          .from('time_entries')
          .update({ 
            is_billed: true
          })
          .in('id', entryIds)

        if (updateError) {
          console.error(`   ❌ Error updating time entries for invoice ${invoice.invoice_number}:`, updateError.message)
          errors++
          continue
        }

        console.log(`   ✓ Invoice ${invoice.invoice_number}: Marked ${entryIds.length} time entries as billed`)
        totalEntriesUpdated += entryIds.length
        invoicesProcessed++

      } catch (err) {
        console.error(`   ❌ Unexpected error processing invoice ${invoice.invoice_number}:`, err.message)
        errors++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 BACKFILL COMPLETE')
    console.log('='.repeat(60))
    console.log(`Invoices processed: ${invoicesProcessed}/${invoices.length}`)
    console.log(`Time entries updated: ${totalEntriesUpdated}`)
    console.log(`Errors: ${errors}`)

    if (errors > 0) {
      console.log('\n⚠️  Some invoices had errors. Check logs above.')
      process.exit(1)
    } else {
      console.log('\n✅ All time entries successfully updated!')
    }

  } catch (err) {
    console.error('\n❌ Fatal error:', err.message)
    process.exit(1)
  }
}

// Run the backfill
backfillTimeBilledStatus()
