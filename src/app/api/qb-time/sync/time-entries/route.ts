import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshTokenIfNeeded } from '@/lib/qbo/sync/qbo-client'
import { syncTimeEntries } from '@/lib/qbo/sync/domains/time-entries'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { startSyncRun, completeSyncRun, parseDomainCounts } from '@/lib/qbo/sync/common'

export async function POST(request: NextRequest) {
  try {
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

    const runId = await startSyncRun('time_entries', isInternalSync ? 'webhook' : 'manual', { syncType: 'time' })

    try {
      const results = await syncTimeEntries(supabase, settings)
      const counts = parseDomainCounts(results)
      
      await completeSyncRun(runId, {
        status: (counts.errors || 0) > 0 ? 'partial_success' : 'success',
        counts,
      })

      return NextResponse.json({
        success: true,
        counts,
        results
      })
    } catch (error) {
      await completeSyncRun(runId, {
        status: 'failed',
        counts: { errors: 1 },
        errorSummary: {
          category: 'sync_error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Time entries sync failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Time entries sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Time entries sync failed' },
      { status: 500 }
    )
  }
}
