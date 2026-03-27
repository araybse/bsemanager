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

    // Fetch the specific customer from QuickBooks
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${settings.realm_id}/customer/${id}`,
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
    const customer = data.Customer

    // Transform to our schema
    const customerRecord = {
      qb_id: customer.Id,
      name: customer.DisplayName || customer.CompanyName || '',
      company_name: customer.CompanyName || null,
      email: customer.PrimaryEmailAddr?.Address || null,
      phone: customer.PrimaryPhone?.FreeFormNumber || null,
      active: customer.Active !== false,
      synced_at: new Date().toISOString()
    }

    // Upsert to database
    const { error } = await supabase
      .from('customers')
      .upsert(customerRecord as never, { onConflict: 'qb_id' } as never)

    if (error) throw error

    // Update sync_runs
    await supabase
      .from('sync_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        imported_count: 1
      } as never)
      .eq('domain', 'customers')
      .eq('trigger_mode', 'webhook')
      .is('completed_at', null)

    return NextResponse.json({
      success: true,
      synced: customerRecord
    } as never)

  } catch (error) {
    console.error('Customer sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
