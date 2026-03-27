import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshTokenIfNeeded } from '@/lib/qbo/sync/qbo-client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    
    // Verify internal sync token
    const token = request.headers.get('x-internal-sync-token')
    if (token !== process.env.INTERNAL_SYNC_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 } as never)
    }

    // Get QB credentials
    const settings = await refreshTokenIfNeeded(supabase)

    // Fetch the specific payment from QuickBooks
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${settings.realm_id}/payment/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${settings.access_token}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`QB API error: ${response.statusText}`)
    }

    const data = await response.json()
    const payment = data.Payment

    // Transform to our schema
    const paymentRecord = {
      qb_id: payment.Id,
      customer_id: payment.CustomerRef?.value || null,
      payment_date: payment.TxnDate,
      total_amount: parseFloat(payment.TotalAmt || 0),
      payment_method: payment.PaymentMethodRef?.name || null,
      reference_number: payment.PaymentRefNum || null,
      synced_at: new Date().toISOString()
    }

    // Upsert to database
    const { error } = await supabase
      .from('payments')
      .upsert(paymentRecord as never, { onConflict: 'qb_id' } as never)

    if (error) throw error

    // Also update invoice payment allocations
    if (payment.Line) {
      for (const line of payment.Line) {
        if (line.LinkedTxn) {
          for (const txn of line.LinkedTxn) {
            if (txn.TxnType === 'Invoice') {
              await supabase
                .from('invoice_payments')
                .upsert({
                  invoice_qb_id: txn.TxnId,
                  payment_qb_id: payment.Id,
                  amount: parseFloat(line.Amount || 0)
                } as never, { onConflict: 'invoice_qb_id,payment_qb_id' })
            }
          }
        }
      }
    }

    // Update sync_runs
    await supabase
      .from('sync_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        imported_count: 1
      } as never)
      .eq('domain', 'payments')
      .eq('trigger_mode', 'webhook')
      .is('completed_at', null)

    return NextResponse.json({
      success: true,
      synced: paymentRecord
    } as never)

  } catch (error) {
    console.error('Payment sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
