import { createAdminClient } from '@/lib/supabase/admin'

type TriggerMode = 'manual' | 'webhook' | 'scheduled'
type RunStatus = 'in_progress' | 'success' | 'partial_success' | 'failed'

type RunCounts = {
  imported?: number
  updated?: number
  deleted?: number
  skipped?: number
  errors?: number
}

type SyncErrorCategory = 'auth' | 'qbo_rate_limit' | 'validation' | 'db' | 'unknown'

type CompleteOptions = {
  status: RunStatus
  finishedAt?: string
  counts?: RunCounts
  errorSummary?: Record<string, unknown> | null
}

export async function startSyncRun(
  domain: string,
  triggerMode: TriggerMode,
  payload?: Record<string, unknown> | null
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sync_runs')
    .insert({
      domain,
      trigger_mode: triggerMode,
      started_at: new Date().toISOString(),
      request_payload: payload || null,
      status: 'in_progress',
    } as never)
    .select('id')
    .single()

  if (error) {
    console.error('Failed to start sync run:', domain, error.message)
    return null
  }

  return (data as { id: number }).id
}

export async function completeSyncRun(runId: number | null, options: CompleteOptions) {
  if (!runId) return
  const supabase = createAdminClient()
  const counts = options.counts || {}
  const { error } = await supabase
    .from('sync_runs')
    .update({
      status: options.status,
      finished_at: options.finishedAt || new Date().toISOString(),
      imported_count: counts.imported || 0,
      updated_count: counts.updated || 0,
      deleted_count: counts.deleted || 0,
      skipped_count: counts.skipped || 0,
      error_count: counts.errors || 0,
      error_summary: options.errorSummary || null,
    } as never)
    .eq('id' as never, runId as never)

  if (error) {
    console.error('Failed to complete sync run:', runId, error.message)
  }
}

export async function advanceWatermark(
  domain: string,
  qboUpdatedAt: string | null,
  cursor: string | null = null
) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('sync_watermarks')
    .upsert(
      {
        domain,
        last_successful_qbo_updated_at: qboUpdatedAt,
        last_successful_cursor: cursor,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'domain' }
    )

  if (error) {
    console.error('Failed to advance watermark:', domain, error.message)
  }
}

export function parseDomainCounts(result: Record<string, unknown> | null | undefined): RunCounts {
  if (!result) return {}
  return {
    imported: Number(result.imported || 0),
    updated: Number(result.updated || 0),
    deleted: Number(result.deleted || 0),
    skipped: Number(result.skipped || 0),
    errors: Number(result.errors || 0),
  }
}

export function classifySyncError(error: unknown): {
  category: SyncErrorCategory
  message: string
} {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  if (
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('invalid signature') ||
    normalized.includes('token')
  ) {
    return { category: 'auth', message }
  }

  if (normalized.includes('429') || normalized.includes('rate limit')) {
    return { category: 'qbo_rate_limit', message }
  }

  if (
    normalized.includes('invalid') ||
    normalized.includes('missing') ||
    normalized.includes('not found') ||
    normalized.includes('constraint')
  ) {
    return { category: 'validation', message }
  }

  if (
    normalized.includes('postgres') ||
    normalized.includes('supabase') ||
    normalized.includes('duplicate key') ||
    normalized.includes('db')
  ) {
    return { category: 'db', message }
  }

  return { category: 'unknown', message }
}
