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

    // Fetch the specific time activity from QuickBooks
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${settings.realm_id}/timeactivity/${id}`,
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
    const timeActivity = data.TimeActivity

    // Transform to our schema
    const timeEntry = {
      qb_id: timeActivity.Id,
      employee_id: timeActivity.EmployeeRef?.value || null,
      project_id: timeActivity.CustomerRef?.value || null,
      entry_date: timeActivity.TxnDate,
      hours: parseFloat(timeActivity.Hours || 0),
      description: timeActivity.Description || '',
      billable_status: timeActivity.BillableStatus || 'NotBillable',
      hourly_rate: parseFloat(timeActivity.HourlyRate || 0),
      billable_amount: parseFloat(timeActivity.Hours || 0) * parseFloat(timeActivity.HourlyRate || 0),
      synced_at: new Date().toISOString()
    }

    // Upsert to database
    const { error } = await supabase
      .from('time_entries')
      .upsert(timeEntry as never, { onConflict: 'qb_id' } as never)

    if (error) throw error

    // Update sync_runs
    await supabase
      .from('sync_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        imported_count: 1
      } as never)
      .eq('domain', 'time_entries')
      .eq('trigger_mode', 'webhook')
      .is('completed_at', null)

    return NextResponse.json({
      success: true,
      synced: timeEntry
    } as never)

  } catch (error) {
    console.error('Time entry sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
