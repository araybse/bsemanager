import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  advanceWatermark,
  classifySyncError,
  completeSyncRun,
  parseDomainCounts,
  startSyncRun,
} from '@/lib/qbo/sync/common'
import { refreshTokenIfNeeded } from '@/lib/qbo/sync/qbo-client'
import { syncCustomers } from '@/lib/qbo/sync/domains/customers'
import { requireApiRoles } from '@/lib/auth/api-authorization'

/**
 * Sync Customers from QuickBooks
 * Individual route for customers domain
 */
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

    const syncTimestamp = new Date().toISOString()
    const triggerMode = isInternalSync ? 'webhook' : 'manual'
    const runId = await startSyncRun('customers', triggerMode, { syncType: 'customers' })

    try {
      const domainResults = await syncCustomers(supabase, settings)
      const counts = parseDomainCounts(domainResults)
      const status = (counts.errors || 0) > 0 ? 'partial_success' : 'success'

      await completeSyncRun(runId, {
        status,
        counts,
        errorSummary: null,
      })

      await advanceWatermark('customers', syncTimestamp, null)
      await supabase
        .from('qb_settings')
        .update({ last_customer_sync_at: syncTimestamp } as never)
        .eq('id' as never, settings.id as never)

      return NextResponse.json({
        success: true,
        domain: 'customers',
        results: domainResults,
        counts,
        synced_at: syncTimestamp
      })
    } catch (error) {
      const classified = classifySyncError(error)
      await completeSyncRun(runId, {
        status: 'failed',
        counts: { errors: 1 },
        errorSummary: {
          category: classified.category,
          message: classified.message,
        },
      })

      return NextResponse.json({
        success: false,
        domain: 'customers',
        error: classified.message,
        category: classified.category
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Customers sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Customers sync failed' },
      { status: 500 }
    )
  }
}
