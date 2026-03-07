import type { SupabaseClient } from '@supabase/supabase-js'

type CrossingResolveInput = {
  crossingId: number
  finishGradeElev: number
  gravityUpstreamInvert: number
  gravityDownstreamInvert: number
  distanceFromUpstreamFt: number
  totalRunFt: number
  gravityDiameterIn: number
  pressureTopElev: number
  requiredClearanceFt: number
}

export function resolveCrossingGeometry(input: CrossingResolveInput) {
  const slopePerFt = (input.gravityDownstreamInvert - input.gravityUpstreamInvert) / input.totalRunFt
  const gravityInvertAtCrossing = input.gravityUpstreamInvert + slopePerFt * input.distanceFromUpstreamFt
  const gravityTop = gravityInvertAtCrossing + input.gravityDiameterIn / 12
  const gravityBottom = gravityInvertAtCrossing
  const pressureTop = input.pressureTopElev
  const pressureBottom = pressureTop - 0.5
  const measuredClearanceFt = Math.abs(pressureBottom - gravityTop)
  const conflictDetected = measuredClearanceFt < input.requiredClearanceFt

  return {
    gravityTop,
    gravityBottom,
    pressureTop,
    pressureBottom,
    finishGradeElev: input.finishGradeElev,
    measuredClearanceFt,
    conflictDetected,
    resultStatus: conflictDetected ? 'conflict' : 'ok',
  }
}

export async function persistCrossingResolution(
  supabase: SupabaseClient,
  input: CrossingResolveInput,
  outputs: ReturnType<typeof resolveCrossingGeometry>,
  editedBy?: string | null
) {
  const { error: geometryError } = await supabase.from('crossing_geometry').upsert(
    {
      crossing_id: input.crossingId,
      gravity_top_elev: outputs.gravityTop,
      gravity_bottom_elev: outputs.gravityBottom,
      pressure_top_elev: outputs.pressureTop,
      pressure_bottom_elev: outputs.pressureBottom,
      finish_grade_elev: outputs.finishGradeElev,
      interpolation_meta: {
        distance_from_upstream_ft: input.distanceFromUpstreamFt,
        total_run_ft: input.totalRunFt,
      } as never,
    } as never,
    { onConflict: 'crossing_id' }
  )
  if (geometryError) throw geometryError

  const { error: resultError } = await supabase.from('crossing_results').insert({
    crossing_id: input.crossingId,
    conflict_detected: outputs.conflictDetected,
    required_clearance_ft: input.requiredClearanceFt,
    measured_clearance_ft: outputs.measuredClearanceFt,
    result_status: outputs.resultStatus,
    result_payload: outputs as never,
  } as never)
  if (resultError) throw resultError

  const { error: statusError } = await supabase
    .from('crossings')
    .update({
      status: outputs.conflictDetected ? 'review' : 'resolved',
      sync_state: 'pending_publish',
      updated_by: editedBy || null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', input.crossingId as never)
  if (statusError) throw statusError
}
