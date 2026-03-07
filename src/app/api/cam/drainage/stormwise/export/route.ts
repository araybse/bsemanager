import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'
import { insertCamSyncEvent } from '@/lib/cam/sync'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const projectId = Number(request.nextUrl.searchParams.get('projectId') || 0)
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('drainage_basins')
      .select('basin_code, basin_name, area_acres, soil_group')
      .eq('project_id', projectId as never)
      .order('basin_code')
    if (error) throw error

    const rows = (data || []) as Array<{
      basin_code: string
      basin_name: string
      area_acres: number
      soil_group: string | null
    }>
    const csv = [
      'basin_code,basin_name,area_acres,soil_group',
      ...rows.map(
        (row) =>
          `${row.basin_code},${row.basin_name},${row.area_acres},${row.soil_group || ''}`
      ),
    ].join('\n')

    await supabase.from('drainage_model_exchange').insert({
      project_id: projectId,
      model_vendor: 'stormwise',
      exchange_direction: 'export',
      exchange_payload: { row_count: rows.length } as never,
      status: 'success',
    } as never)

    await insertCamSyncEvent(supabase, {
      projectId,
      sourceSystem: 'supabase',
      targetSystem: 'stormwise',
      entityTable: 'drainage_model_exchange',
      eventType: 'publish',
      status: 'success',
      requestPayload: { project_id: projectId },
      responsePayload: { row_count: rows.length },
    })

    return NextResponse.json({ success: true, csv })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed StormWise export' },
      { status: 500 }
    )
  }
}
