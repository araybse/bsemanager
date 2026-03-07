import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeDataQualityChecks } from '@/lib/data-quality/checks'

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const checks = await computeDataQualityChecks(supabase)

    const phaseMismatchCount = checks.phaseNameMismatches.count
    const duplicateCandidateCount = checks.duplicateCostCandidates.count

    const { data, error } = await supabase
      .from('data_quality_runs')
      .insert({
        trigger_mode: 'scheduled',
        phase_mismatch_count: phaseMismatchCount,
        duplicate_candidate_count: duplicateCandidateCount,
        results: checks,
      } as never)
      .select('id, created_at, phase_mismatch_count, duplicate_candidate_count')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,
      run: data,
      checks,
    })
  } catch (error) {
    console.error('Scheduled data quality run failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scheduled run failed' },
      { status: 500 }
    )
  }
}
