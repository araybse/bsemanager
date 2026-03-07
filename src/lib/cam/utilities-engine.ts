import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

type UtilitiesInput = {
  projectId: number
  calcType: 'lift_station' | 'fire_flow'
  demandGpm: number
  availablePressurePsi: number
  minRequiredPressurePsi: number
  totalDynamicHeadFt?: number
}

export function runUtilitiesCalculation(input: UtilitiesInput) {
  const pressureMarginPsi = input.availablePressurePsi - input.minRequiredPressurePsi
  const estimatedPumpHp =
    input.calcType === 'lift_station'
      ? (input.demandGpm * (input.totalDynamicHeadFt || 0)) / 3960
      : 0

  const status = pressureMarginPsi < 0 ? 'warning' : 'success'

  return {
    pressureMarginPsi,
    estimatedPumpHp: Number(estimatedPumpHp.toFixed(2)),
    meetsRequirement: pressureMarginPsi >= 0,
    status,
  }
}

export async function persistUtilitiesCalculation(
  supabase: SupabaseClient,
  input: UtilitiesInput,
  outputs: ReturnType<typeof runUtilitiesCalculation>,
  createdBy?: string | null
) {
  const row = {
    project_id: input.projectId,
    calc_type: input.calcType,
    run_id: randomUUID(),
    inputs: input as never,
    outputs: outputs as never,
    status: outputs.status,
    created_by: createdBy || null,
  }

  const { data, error } = await supabase
    .from('utilities_calculations')
    .insert(row as never)
    .select('id, calculated_at')
    .single()
  if (error) throw error
  return data
}
