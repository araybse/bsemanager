import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'

const updateSchema = z.object({
  projectId: z.number().int().positive(),
  rolloutCohort: z.string().optional(),
  featureFlags: z.record(z.string(), z.boolean()),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const payload = updateSchema.parse(await request.json())
    const supabase = createAdminClient()

    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .select('project_number')
      .eq('id', payload.projectId as never)
      .single()
    if (projectError) throw projectError

    const { data, error } = await supabase
      .from('cam_projects_ext')
      .upsert(
        {
          project_id: payload.projectId,
          project_number: (projectRow as { project_number: string }).project_number,
          rollout_cohort: payload.rolloutCohort || null,
          feature_flags: payload.featureFlags as never,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'project_id' }
      )
      .select('project_id, rollout_cohort, feature_flags')
      .single()
    if (error) throw error

    return NextResponse.json({ success: true, rollout: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update CAM rollout flags' },
      { status: 500 }
    )
  }
}
