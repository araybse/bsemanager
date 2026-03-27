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

    // Fetch the specific bill from QuickBooks
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${settings.realm_id}/bill/${id}`,
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
    const bill = data.Bill

    // Transform to our schema
    const expense = {
      qb_id: bill.Id,
      vendor_id: bill.VendorRef?.value || null,
      expense_date: bill.TxnDate,
      total_amount: parseFloat(bill.TotalAmt || 0),
      description: bill.PrivateNote || '',
      category: 'Bill',
      synced_at: new Date().toISOString()
    }

    // Upsert to database
    const { error } = await supabase
      .from('expenses')
      .upsert(expense as never, { onConflict: 'qb_id' } as never)

    if (error) throw error

    // Update sync_runs
    await supabase
      .from('sync_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        imported_count: 1
      } as never)
      .eq('domain', 'expenses')
      .eq('trigger_mode', 'webhook')
      .is('completed_at', null)

    return NextResponse.json({
      success: true,
      synced: expense
    } as never)

  } catch (error) {
    console.error('Expense sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
