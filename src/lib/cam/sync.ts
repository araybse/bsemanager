import type { SupabaseClient } from '@supabase/supabase-js'

type FieldFreshnessInput = {
  projectId: number
  entityTable: string
  entityPk: string
  fieldName: string
  fieldValue: unknown
  updatedAtSource: string
  updatedSourceSystem: string
  updatedBy?: string | null
}

type CamSyncEventInput = {
  projectId?: number | null
  sourceSystem: string
  targetSystem?: string | null
  entityTable: string
  entityPk?: string | null
  eventType: 'ingest' | 'publish' | 'reconcile' | 'validation'
  status: 'success' | 'partial_success' | 'failed'
  requestPayload?: Record<string, unknown>
  responsePayload?: Record<string, unknown>
  errorSummary?: Record<string, unknown> | null
}

export async function applyLatestFieldFreshness(
  supabase: SupabaseClient,
  input: FieldFreshnessInput
): Promise<{ accepted: boolean }> {
  const { data: existing, error: existingError } = await supabase
    .from('cam_field_freshness')
    .select('id, updated_at_source, losing_sources')
    .eq('entity_table', input.entityTable)
    .eq('entity_pk', input.entityPk)
    .eq('field_name', input.fieldName)
    .maybeSingle()

  if (existingError) throw existingError

  const incomingAt = new Date(input.updatedAtSource).getTime()
  const existingAt = existing?.updated_at_source ? new Date(existing.updated_at_source as string).getTime() : 0

  if (!existing || incomingAt >= existingAt) {
    const payload = {
      project_id: input.projectId,
      entity_table: input.entityTable,
      entity_pk: input.entityPk,
      field_name: input.fieldName,
      field_value: input.fieldValue as never,
      updated_at_source: input.updatedAtSource,
      updated_source_system: input.updatedSourceSystem,
      updated_by: input.updatedBy || null,
      sync_state: 'synced',
      losing_sources: (existing?.losing_sources || []) as never,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('cam_field_freshness').upsert(payload as never, {
      onConflict: 'entity_table,entity_pk,field_name',
    })
    if (error) throw error
    return { accepted: true }
  }

  const oldLosingSources = Array.isArray(existing.losing_sources) ? existing.losing_sources : []
  const losingSources = [
    ...oldLosingSources,
    { source: input.updatedSourceSystem, updated_at_source: input.updatedAtSource },
  ].slice(-20)

  const { error } = await supabase
    .from('cam_field_freshness')
    .update({
      sync_state: 'pending_publish',
      losing_sources: losingSources as never,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', existing.id as never)
  if (error) throw error

  return { accepted: false }
}

export async function insertCamSyncEvent(
  supabase: SupabaseClient,
  input: CamSyncEventInput
): Promise<string> {
  const payload = {
    project_id: input.projectId || null,
    source_system: input.sourceSystem,
    target_system: input.targetSystem || null,
    entity_table: input.entityTable,
    entity_pk: input.entityPk || null,
    event_type: input.eventType,
    status: input.status,
    request_payload: (input.requestPayload || {}) as never,
    response_payload: (input.responsePayload || {}) as never,
    error_summary: (input.errorSummary || null) as never,
    occurred_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('cam_sync_events')
    .insert(payload as never)
    .select('id')
    .single()
  if (error) throw error
  return String((data as { id: number } | null)?.id ?? '')
}
