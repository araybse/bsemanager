import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshTokenIfNeeded } from '@/lib/qbo/sync/qbo-client'
import { requireApiRoles } from '@/lib/auth/api-authorization'

/**
 * Sync a single invoice from QuickBooks
 * Triggered by webhooks or manual refresh
 * 
 * @param id - QuickBooks Invoice ID
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 16 requirement)
    const { id: invoiceId } = await params
    
    // Check auth (allow internal webhook calls or admin/PM users)
    const internalSyncToken = request.headers.get('x-internal-sync-token')
    const expectedInternalSyncToken = process.env.INTERNAL_SYNC_TOKEN
    const isInternalSync =
      !!internalSyncToken &&
      !!expectedInternalSyncToken &&
      internalSyncToken === expectedInternalSyncToken

    if (!isInternalSync) {
      const auth = await requireApiRoles(['admin', 'project_manager'])
      if (!auth.ok) return auth.response
    }

    const supabase = createAdminClient()
    const settings = await refreshTokenIfNeeded(supabase)

    if (!settings.realm_id) {
      return NextResponse.json(
        { error: 'No QuickBooks company connected' },
        { status: 400 }
      )
    }
    const body = await request.json().catch(() => ({}))
    const operation = body.operation || 'Update'

    // Fetch the invoice from QuickBooks
    const qbResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${settings.realm_id}/invoice/${invoiceId}?minorversion=73`,
      {
        headers: {
          Authorization: `Bearer ${settings.access_token}`,
          Accept: 'application/json'
        }
      }
    )

    if (!qbResponse.ok) {
      if (qbResponse.status === 404 && operation === 'Delete') {
        // Invoice was deleted in QB - mark as deleted in our system
        await supabase
          .from('invoices')
          .update({ 
            status: 'deleted',
            deleted_at: new Date().toISOString() 
          } as never)
          .eq('qbo_invoice_id' as never, invoiceId as never)

        return NextResponse.json({
          success: true,
          action: 'deleted',
          invoice_id: invoiceId
        })
      }

      throw new Error(`QB API error: ${qbResponse.status} ${await qbResponse.text()}`)
    }

    const { Invoice } = await qbResponse.json()

    // Transform and upsert invoice
    // (This would call your existing syncInvoices logic for a single invoice)
    // For now, basic upsert:
    
    const invoiceData = {
      qbo_invoice_id: Invoice.Id,
      qbo_sync_token: Invoice.SyncToken,
      invoice_number: Invoice.DocNumber,
      customer_ref_id: Invoice.CustomerRef?.value,
      customer_name: Invoice.CustomerRef?.name,
      txn_date: Invoice.TxnDate,
      due_date: Invoice.DueDate,
      total_amount: parseFloat(Invoice.TotalAmt || '0'),
      balance: parseFloat(Invoice.Balance || '0'),
      status: Invoice.Balance > 0 ? 'unpaid' : 'paid',
      qbo_last_updated_at: Invoice.MetaData?.LastUpdatedTime,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('invoices')
      .upsert(invoiceData as never, {
        onConflict: 'qbo_invoice_id'
      })
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      action: operation.toLowerCase(),
      invoice: data?.[0],
      synced_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Invoice sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invoice sync failed' },
      { status: 500 }
    )
  }
}
