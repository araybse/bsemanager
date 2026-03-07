import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'
import { utilitiesLetterSchema } from '@/lib/cam/contracts'
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
      .from('utilities_external_letters')
      .select('*')
      .eq('project_id', projectId as never)
      .order('entered_at', { ascending: false })
    if (error) throw error

    return NextResponse.json({ letters: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch external letters' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const payload = utilitiesLetterSchema.parse(await request.json())
    const supabase = createAdminClient()

    const row = {
      project_id: payload.projectId,
      letter_type: payload.letterType,
      issuer_name: payload.issuerName || null,
      letter_date: payload.letterDate || null,
      reference_number: payload.referenceNumber || null,
      values: payload.values as never,
      entered_by: auth.user.email || auth.user.id,
    }

    const { data, error } = await supabase
      .from('utilities_external_letters')
      .insert(row as never)
      .select('*')
      .single()
    if (error) throw error

    await insertCamSyncEvent(supabase, {
      projectId: payload.projectId,
      sourceSystem: 'portal_form',
      targetSystem: 'supabase',
      entityTable: 'utilities_external_letters',
      entityPk: String((data as { id: number } | null)?.id || ''),
      eventType: 'ingest',
      status: 'success',
      requestPayload: payload as unknown as Record<string, unknown>,
      responsePayload: { id: (data as { id: number } | null)?.id || null },
    })

    return NextResponse.json({ success: true, letter: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create external letter' },
      { status: 500 }
    )
  }
}
