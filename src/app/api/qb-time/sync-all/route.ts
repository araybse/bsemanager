import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshTokenIfNeeded } from '@/lib/qbo/sync/qbo-client'
import { requireApiRoles } from '@/lib/auth/api-authorization'

/**
 * Orchestrator: Sync All Domains in Parallel
 * 
 * This route calls individual domain sync routes concurrently for maximum speed.
 * Instead of syncing sequentially (5+ minutes), domains sync in parallel (~90 seconds).
 * 
 * Use this for:
 * - Manual "Sync All" button
 * - Scheduled full syncs
 * - Initial data import
 * 
 * For single-domain syncs, use:
 * - POST /api/qb-time/sync/customers
 * - POST /api/qb-time/sync/invoices
 * - etc.
 */

interface DomainSyncResult {
  domain: string
  success: boolean
  counts?: {
    imported?: number
    updated?: number
    errors?: number
  }
  error?: string
  duration_ms?: number
}

async function syncDomain(
  domain: string,
  baseUrl: string,
  internalToken: string
): Promise<DomainSyncResult> {
  const startTime = Date.now()
  
  try {
    const response = await fetch(`${baseUrl}/api/qb-time/sync/${domain}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-sync-token': internalToken
      }
    })

    const duration_ms = Date.now() - startTime
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return {
        domain,
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
        duration_ms
      }
    }

    const data = await response.json()
    return {
      domain,
      success: true,
      counts: data.counts,
      duration_ms
    }
  } catch (error) {
    return {
      domain,
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
      duration_ms: Date.now() - startTime
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const internalSyncToken = request.headers.get('x-internal-sync-token')
    const expectedInternalSyncToken = process.env.INTERNAL_SYNC_TOKEN
    const isInternalSync =
      !!internalSyncToken &&
      !!expectedInternalSyncToken &&
      internalSyncToken === expectedInternalSyncToken

    if (!isInternalSync) {
      const auth = await requireApiRoles(['admin'])
      if (!auth.ok) return auth.response
    }

    // Verify QB connection
    const supabase = createAdminClient()
    const settings = await refreshTokenIfNeeded(supabase)

    if (!settings.realm_id) {
      return NextResponse.json(
        { error: 'No QuickBooks company connected' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const internalToken = process.env.INTERNAL_SYNC_TOKEN || ''

    // Parse request body for sync options
    let syncYear: number | undefined
    let syncMonth: number | undefined
    try {
      const body = await request.json()
      if (body.year) syncYear = Number(body.year)
      if (body.month) syncMonth = Number(body.month)
    } catch {
      // No body, use defaults
    }

    // Define domains to sync
    const domains = [
      'customers',
      'projects',
      'invoices',
      'payments',
      // Time entries sync separately due to year/month params
      // Expenses sync separately
    ]

    const overallStartTime = Date.now()

    // Sync all domains in parallel
    const results = await Promise.all(
      domains.map(domain => syncDomain(domain, baseUrl, internalToken))
    )

    // Sync time entries separately (with year/month params if provided)
    const timeEntriesResult = await syncDomain(
      `time-entries${syncYear ? `?year=${syncYear}` : ''}${syncMonth ? `&month=${syncMonth}` : ''}`,
      baseUrl,
      internalToken
    )
    results.push(timeEntriesResult)

    // Sync expenses
    const expensesResult = await syncDomain('expenses', baseUrl, internalToken)
    results.push(expensesResult)

    const overallDuration = Date.now() - overallStartTime
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    // Calculate totals
    const totalCounts = results.reduce((acc, r) => ({
      imported: (acc.imported || 0) + (r.counts?.imported || 0),
      updated: (acc.updated || 0) + (r.counts?.updated || 0),
      errors: (acc.errors || 0) + (r.counts?.errors || 0)
    }), { imported: 0, updated: 0, errors: 0 })

    return NextResponse.json({
      success: failureCount === 0,
      message: failureCount === 0 
        ? 'All domains synced successfully' 
        : `${successCount} domains succeeded, ${failureCount} failed`,
      duration_ms: overallDuration,
      results,
      totals: totalCounts,
      parallel_speedup: true
    })

  } catch (error) {
    console.error('Sync all error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync all failed' },
      { status: 500 }
    )
  }
}
