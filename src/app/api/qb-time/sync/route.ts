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
import { syncProjects } from '@/lib/qbo/sync/domains/projects'
import { syncInvoices } from '@/lib/qbo/sync/domains/invoices'
import { syncTimeEntries } from '@/lib/qbo/sync/domains/time-entries'
import { syncContractLabor } from '@/lib/qbo/sync/domains/contract-labor'
import { syncProjectExpenses } from '@/lib/qbo/sync/domains/project-expenses'
import { syncPayments } from '@/lib/qbo/sync/domains/payments'
import type { SyncType } from '@/lib/qbo/sync/types'
import { requireApiRoles } from '@/lib/auth/api-authorization'

async function runDomainSync(options: {
  domain: string
  resultsKey: string
  syncType: SyncType
  settingsId: number
  qbSettingsColumn:
    | 'last_customer_sync_at'
    | 'last_project_sync_at'
    | 'last_invoice_sync_at'
    | 'last_time_sync_at'
    | 'last_contract_labor_sync_at'
    | 'last_expense_sync_at'
    | 'last_payment_sync_at'
  run: () => Promise<Record<string, unknown>>
  supabase: ReturnType<typeof createAdminClient>
  results: Record<string, unknown>
  syncTimestamp: string
  triggerMode: 'manual' | 'webhook' | 'scheduled'
}) {
  const runId = await startSyncRun(options.domain, options.triggerMode, { syncType: options.syncType })

  try {
    const domainResults = await options.run()
    options.results[options.resultsKey] = domainResults
    const counts = parseDomainCounts(domainResults)
    const status = (counts.errors || 0) > 0 ? 'partial_success' : 'success'
    const resultComparison =
      options.domain === 'time_entries'
        ? ((domainResults as { comparison?: Record<string, unknown>; windows?: unknown }).comparison ?? null)
        : null
    const resultWindows =
      options.domain === 'time_entries'
        ? ((domainResults as { comparison?: Record<string, unknown>; windows?: unknown }).windows ?? null)
        : null
    await completeSyncRun(runId, {
      status,
      counts,
      errorSummary:
        resultComparison || resultWindows
          ? {
              comparison: resultComparison,
              windows: resultWindows,
            }
          : null,
    })
    await advanceWatermark(options.domain, options.syncTimestamp, null)
    await options.supabase
      .from('qb_settings')
      .update({ [options.qbSettingsColumn]: options.syncTimestamp } as never)
      .eq('id' as never, options.settingsId as never)
    return { ok: true as const, counts }
  } catch (error) {
    const classified = classifySyncError(error)
    options.results[options.resultsKey] = {
      imported: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: 1,
      errorCategory: classified.category,
      errorMessage: classified.message,
    }
    await completeSyncRun(runId, {
      status: 'failed',
      counts: { errors: 1 },
      errorSummary: {
        category: classified.category,
        message: classified.message,
      },
    })
    return { ok: false as const, error: classified }
  }
}

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
        { error: 'No QuickBooks company connected. Please reconnect.' },
        { status: 400 }
      )
    }

    let syncType: SyncType = 'all'
    let syncYear: number | undefined
    let syncMonth: number | undefined
    const queryType = request.nextUrl?.searchParams?.get('type')
    const queryYear = request.nextUrl?.searchParams?.get('year')
    const queryMonth = request.nextUrl?.searchParams?.get('month')
    const queryTrigger = request.nextUrl?.searchParams?.get('trigger')
    if (queryType) {
      syncType = queryType as SyncType
      if (queryYear) {
        const parsed = Number(queryYear)
        if (Number.isInteger(parsed)) syncYear = parsed
      }
      if (queryMonth) {
        const parsed = Number(queryMonth)
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 12) syncMonth = parsed
      }
    } else {
      try {
        const body = await request.json()
        syncType = body.type || 'all'
        const parsed = Number(body.year)
        if (Number.isInteger(parsed)) syncYear = parsed
        const parsedMonth = Number(body.month)
        if (Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
          syncMonth = parsedMonth
        }
      } catch {
        // Leave default value.
      }
    }

    const results: Record<string, unknown> = {}
    const syncTimestamp = new Date().toISOString()
    const runFailures: Array<{ domain: string; category: string; message: string }> = []
    const triggerMode = (queryTrigger === 'scheduled' ? 'scheduled' : (isInternalSync ? 'webhook' : 'manual')) as 'manual' | 'webhook' | 'scheduled'

    if (syncType === 'all' || syncType === 'time') {
      const staleCutoffIso = new Date(Date.now() - 90 * 60 * 1000).toISOString()
      const { data: openRuns } = await supabase
        .from('sync_runs')
        .select('id, started_at')
        .eq('domain', 'time_entries')
        .eq('status', 'in_progress')
        .is('finished_at', null)
        .order('started_at', { ascending: false })

      const activeRuns = ((openRuns as Array<{ id: number; started_at: string }> | null) || []).filter(
        (run) => run.started_at >= staleCutoffIso
      )
      const staleRuns = ((openRuns as Array<{ id: number; started_at: string }> | null) || []).filter(
        (run) => run.started_at < staleCutoffIso
      )

      if (staleRuns.length > 0) {
        await supabase
          .from('sync_runs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error_count: 1,
            error_summary: {
              category: 'timeout',
              message: 'Marked stale after 90 minutes without completion.',
            },
          } as never)
          .in(
            'id' as never,
            staleRuns.map((run) => run.id) as never
          )
      }

      if (activeRuns.length > 0) {
        return NextResponse.json(
          {
            error:
              'A time-entry sync is already in progress. Please wait for it to complete before starting a new run.',
            activeRunCount: activeRuns.length,
          },
          { status: 409 }
        )
      }
    }

    if (syncType === 'all' || syncType === 'customers') {
      const outcome = await runDomainSync({
        domain: 'customers',
        resultsKey: 'customers',
        syncType,
        settingsId: settings.id,
        qbSettingsColumn: 'last_customer_sync_at',
        run: () => syncCustomers(supabase, settings),
        supabase,
        results,
        syncTimestamp,
        triggerMode,
      })
      if (!outcome.ok) {
        runFailures.push({
          domain: 'customers',
          category: outcome.error.category,
          message: outcome.error.message,
        })
      }
    }

    if (syncType === 'all' || syncType === 'projects') {
      const outcome = await runDomainSync({
        domain: 'projects',
        resultsKey: 'projects',
        syncType,
        settingsId: settings.id,
        qbSettingsColumn: 'last_project_sync_at',
        run: () => syncProjects(supabase, settings),
        supabase,
        results,
        syncTimestamp,
        triggerMode,
      })
      if (!outcome.ok) {
        runFailures.push({
          domain: 'projects',
          category: outcome.error.category,
          message: outcome.error.message,
        })
      }
    }

    if (syncType === 'all' || syncType === 'invoices') {
      const outcome = await runDomainSync({
        domain: 'invoices',
        resultsKey: 'invoices',
        syncType,
        settingsId: settings.id,
        qbSettingsColumn: 'last_invoice_sync_at',
        run: () => syncInvoices(supabase, settings),
        supabase,
        results,
        syncTimestamp,
        triggerMode,
      })
      if (!outcome.ok) {
        runFailures.push({
          domain: 'invoices',
          category: outcome.error.category,
          message: outcome.error.message,
        })
      }
    }

    if (syncType === 'all' || syncType === 'payments') {
      const outcome = await runDomainSync({
        domain: 'payments',
        resultsKey: 'payments',
        syncType,
        settingsId: settings.id,
        qbSettingsColumn: 'last_payment_sync_at',
        run: () => syncPayments(supabase, settings),
        supabase,
        results,
        syncTimestamp,
        triggerMode,
      })
      if (!outcome.ok) {
        runFailures.push({
          domain: 'payments',
          category: outcome.error.category,
          message: outcome.error.message,
        })
      }
    }

    if (syncType === 'all' || syncType === 'time') {
      const outcome = await runDomainSync({
        domain: 'time_entries',
        resultsKey: 'timeEntries',
        syncType,
        settingsId: settings.id,
        qbSettingsColumn: 'last_time_sync_at',
        run: () => syncTimeEntries(supabase, settings, syncYear, syncMonth),
        supabase,
        results,
        syncTimestamp,
        triggerMode,
      })
      if (!outcome.ok) {
        runFailures.push({
          domain: 'time_entries',
          category: outcome.error.category,
          message: outcome.error.message,
        })
      }
    }

    if (syncType === 'all' || syncType === 'contract_labor') {
      const outcome = await runDomainSync({
        domain: 'project_expenses',
        resultsKey: 'contractLabor',
        syncType,
        settingsId: settings.id,
        qbSettingsColumn: 'last_contract_labor_sync_at',
        run: () => syncContractLabor(supabase, settings),
        supabase,
        results,
        syncTimestamp,
        triggerMode,
      })
      if (!outcome.ok) {
        runFailures.push({
          domain: 'project_expenses',
          category: outcome.error.category,
          message: outcome.error.message,
        })
      }
    }

    if (syncType === 'all' || syncType === 'expenses') {
      const outcome = await runDomainSync({
        domain: 'project_expenses_general',
        resultsKey: 'expenses',
        syncType,
        settingsId: settings.id,
        qbSettingsColumn: 'last_expense_sync_at',
        run: () => syncProjectExpenses(supabase, settings),
        supabase,
        results,
        syncTimestamp,
        triggerMode,
      })
      if (!outcome.ok) {
        runFailures.push({
          domain: 'project_expenses_general',
          category: outcome.error.category,
          message: outcome.error.message,
        })
      }
    }

    return NextResponse.json({
      success: runFailures.length === 0,
      results,
      message: runFailures.length ? 'Sync completed with issues' : 'Sync completed successfully',
      failures: runFailures,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
