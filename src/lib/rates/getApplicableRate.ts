/**
 * Rate Resolution Engine
 * 
 * THE canonical function for determining billing rates in IRIS.
 * All rate calculations MUST use this function to ensure consistency.
 * 
 * Priority Order:
 * 1. Project-specific rate override (highest priority)
 * 2. Rate schedule assignment for project
 * 3. Default rate schedule
 * 4. Fallback to $0 (error state - should be logged)
 * 
 * Usage:
 * ```typescript
 * const rate = await getApplicableRate({
 *   projectId: 123,
 *   positionTitle: 'Senior Engineer',
 *   effectiveDate: '2026-03-27'
 * })
 * ```
 */

import { createClient } from '@/lib/supabase/server'

export interface RateResolutionParams {
  projectId: number
  positionTitle: string
  effectiveDate: string // ISO date (YYYY-MM-DD)
  employeeId?: string // Optional: for employee-specific overrides
}

export interface RateResolutionResult {
  hourlyRate: number
  source: 'project_override' | 'rate_schedule' | 'default_schedule' | 'fallback'
  sourceId?: number // ID of the rate record used
  rateScheduleName?: string
  effectiveFrom?: string
  effectiveTo?: string | null
  metadata: {
    projectId: number
    positionTitle: string
    effectiveDate: string
    resolvedAt: string
    warnings?: string[]
  }
}

/**
 * Get the applicable hourly rate for a position on a project
 * 
 * This is the ONLY function that should be used for rate lookups.
 * Any other rate calculation logic should be refactored to use this.
 */
export async function getApplicableRate(
  params: RateResolutionParams
): Promise<RateResolutionResult> {
  const supabase = await createClient()
  const { projectId, positionTitle, effectiveDate, employeeId } = params
  const resolvedAt = new Date().toISOString()
  const warnings: string[] = []

  // Step 1: Check for project-specific rate override
  const { data: projectOverride, error: overrideError } = await supabase
    .from('project_rate_position_overrides')
    .select('*')
    .eq('project_id', projectId)
    .eq('position_title', positionTitle)
    .lte('effective_from', effectiveDate)
    .or(`effective_to.is.null,effective_to.gte.${effectiveDate}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single()

  if (projectOverride && !overrideError) {
    console.log(`[Rate Resolution] Project override found for ${positionTitle} on project ${projectId}`)
    return {
      hourlyRate: parseFloat(projectOverride.hourly_rate),
      source: 'project_override',
      sourceId: projectOverride.id,
      effectiveFrom: projectOverride.effective_from,
      effectiveTo: projectOverride.effective_to,
      metadata: {
        projectId,
        positionTitle,
        effectiveDate,
        resolvedAt
      }
    }
  }

  // Step 2: Check rate schedule assignment for this project
  const { data: scheduleAssignment, error: assignmentError } = await supabase
    .from('project_rate_schedule_assignments')
    .select(`
      *,
      rate_schedule:rate_schedules(
        id,
        name,
        effective_from,
        effective_to
      )
    `)
    .eq('project_id', projectId)
    .lte('effective_from', effectiveDate)
    .or(`effective_to.is.null,effective_to.gte.${effectiveDate}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single()

  if (scheduleAssignment && !assignmentError && scheduleAssignment.rate_schedule) {
    const schedule = scheduleAssignment.rate_schedule as {
      id: number
      name: string
      effective_from: string
      effective_to: string | null
    }

    // Get rate from this schedule
    const { data: scheduleRate, error: rateError } = await supabase
      .from('rate_schedule_items')
      .select('*')
      .eq('rate_schedule_id', schedule.id)
      .eq('position_title', positionTitle)
      .lte('effective_from', effectiveDate)
      .or(`effective_to.is.null,effective_to.gte.${effectiveDate}`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single()

    if (scheduleRate && !rateError) {
      console.log(`[Rate Resolution] Rate schedule "${schedule.name}" found for ${positionTitle} on project ${projectId}`)
      return {
        hourlyRate: parseFloat(scheduleRate.hourly_rate),
        source: 'rate_schedule',
        sourceId: scheduleRate.id,
        rateScheduleName: schedule.name,
        effectiveFrom: scheduleRate.effective_from,
        effectiveTo: scheduleRate.effective_to,
        metadata: {
          projectId,
          positionTitle,
          effectiveDate,
          resolvedAt
        }
      }
    } else {
      warnings.push(`Rate schedule "${schedule.name}" assigned but no rate found for position "${positionTitle}"`)
    }
  }

  // Step 3: Check default rate schedule
  const { data: defaultSchedule, error: defaultError } = await supabase
    .from('rate_schedules')
    .select('*, rate_schedule_items(*)')
    .eq('is_default', true)
    .lte('effective_from', effectiveDate)
    .or(`effective_to.is.null,effective_to.gte.${effectiveDate}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single()

  if (defaultSchedule && !defaultError) {
    const items = defaultSchedule.rate_schedule_items as Array<{
      id: number
      position_title: string
      hourly_rate: string
      effective_from: string
      effective_to: string | null
    }>

    const matchingRate = items.find(item => 
      item.position_title === positionTitle &&
      item.effective_from <= effectiveDate &&
      (item.effective_to === null || item.effective_to >= effectiveDate)
    )

    if (matchingRate) {
      console.log(`[Rate Resolution] Default schedule found for ${positionTitle}`)
      return {
        hourlyRate: parseFloat(matchingRate.hourly_rate),
        source: 'default_schedule',
        sourceId: matchingRate.id,
        rateScheduleName: defaultSchedule.name,
        effectiveFrom: matchingRate.effective_from,
        effectiveTo: matchingRate.effective_to,
        metadata: {
          projectId,
          positionTitle,
          effectiveDate,
          resolvedAt,
          warnings: warnings.length > 0 ? warnings : undefined
        }
      }
    } else {
      warnings.push(`Default schedule exists but no rate for position "${positionTitle}"`)
    }
  }

  // Step 4: Fallback (ERROR STATE - should not happen in production)
  console.error(`[Rate Resolution] NO RATE FOUND for ${positionTitle} on project ${projectId} as of ${effectiveDate}`)
  warnings.push('⚠️ CRITICAL: No rate found via any resolution path')

  return {
    hourlyRate: 0,
    source: 'fallback',
    metadata: {
      projectId,
      positionTitle,
      effectiveDate,
      resolvedAt,
      warnings
    }
  }
}

/**
 * Get rates for multiple positions at once (batch optimization)
 */
export async function getApplicableRates(
  params: Array<RateResolutionParams>
): Promise<Array<RateResolutionResult>> {
  return Promise.all(params.map(p => getApplicableRate(p)))
}

/**
 * Validate that a rate exists before creating a time entry
 * Prevents $0 rates from being used
 */
export async function validateRateExists(
  params: RateResolutionParams
): Promise<{ valid: boolean; rate?: RateResolutionResult; error?: string }> {
  const rate = await getApplicableRate(params)

  if (rate.hourlyRate === 0 || rate.source === 'fallback') {
    return {
      valid: false,
      rate,
      error: `No billing rate configured for "${params.positionTitle}" on project ${params.projectId}`
    }
  }

  return { valid: true, rate }
}
