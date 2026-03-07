import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'

export async function GET() {
  try {
    const auth = await requireApiRoles(['admin', 'project_manager'])
    if (!auth.ok) return auth.response

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('data_quality_runs')
      .select(
        'id, trigger_mode, triggered_by_email, phase_mismatch_count, duplicate_candidate_count, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) throw error

    return NextResponse.json({ runs: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load data quality runs' },
      { status: 500 }
    )
  }
}
