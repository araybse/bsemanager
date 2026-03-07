import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { computeDataQualityChecks } from '@/lib/data-quality/checks'

export async function POST() {
  try {
    const auth = await requireApiRoles(['admin', 'project_manager'])
    if (!auth.ok) return auth.response

    const supabase = createAdminClient()
    const checks = await computeDataQualityChecks(supabase)

    const payload = {
      triggered_by: auth.user.id,
      triggered_by_email: auth.user.email || null,
      trigger_mode: 'manual',
      phase_mismatch_count: checks.phaseNameMismatches.count,
      duplicate_candidate_count: checks.duplicateCostCandidates.count,
      results: checks as unknown as Record<string, unknown>,
    }

    const { data, error } = await supabase
      .from('data_quality_runs')
      .insert(payload as never)
      .select('id, created_at')
      .single()
    if (error) throw error

    return NextResponse.json({
      run: data,
      checks,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run data quality checks' },
      { status: 500 }
    )
  }
}
