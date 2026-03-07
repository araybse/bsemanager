import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

type DrainageInput = {
  projectId: number
  basinCode?: string
  preCn: number
  postCn: number
  areaAcres: number
  aerobicDepthIn: number
  smpFactor: number
}

export function runDrainageCalculation(input: DrainageInput) {
  const runoffDelta = Math.max(0, (input.postCn - input.preCn) * input.areaAcres)
  const storageIndex = input.aerobicDepthIn * input.areaAcres * input.smpFactor
  const calcStatus = runoffDelta > storageIndex ? 'warning' : 'success'

  return {
    runoffDelta,
    storageIndex,
    recommendedStorage: Math.max(0, runoffDelta - storageIndex),
    calcStatus,
  }
}

export async function persistDrainageCalculation(
  supabase: SupabaseClient,
  input: DrainageInput,
  outputs: ReturnType<typeof runDrainageCalculation>,
  createdBy?: string | null
) {
  const { data: basin } = await supabase
    .from('drainage_basins')
    .select('id')
    .eq('project_id', input.projectId as never)
    .eq('basin_code', input.basinCode || '' as never)
    .maybeSingle()

  const row = {
    project_id: input.projectId,
    basin_id: ((basin as { id: number } | null)?.id || null) as never,
    calc_type: 'storm_tab_core',
    run_id: randomUUID(),
    inputs: input as never,
    outputs: outputs as never,
    status: outputs.calcStatus,
    created_by: createdBy || null,
  }

  const { data, error } = await supabase
    .from('drainage_calculations')
    .insert(row as never)
    .select('id, calculated_at')
    .single()
  if (error) throw error
  return data
}
