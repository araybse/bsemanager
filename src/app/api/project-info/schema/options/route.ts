import { NextRequest, NextResponse } from 'next/server'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await requireApiRoles(['admin'])
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const body = (await request.json().catch(() => ({}))) as {
    field_id?: number
    label?: string
    value?: string
    sort_order?: number
  }

  const fieldId = Number(body.field_id)
  const label = String(body.label || '').trim()
  const value = String(body.value || '').trim()
  const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100

  if (!Number.isFinite(fieldId)) return NextResponse.json({ error: 'field_id is required' }, { status: 400 })
  if (!label || !value) {
    return NextResponse.json({ error: 'Option label and value are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_info_field_option_catalog' as never)
    .insert({ field_id: fieldId, label, value, sort_order: sortOrder, is_active: true } as never)
    .select('id, field_id, label, value, sort_order, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ option: data })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiRoles(['admin'])
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const body = (await request.json().catch(() => ({}))) as {
    id?: number
    label?: string
    value?: string
    sort_order?: number
    is_active?: boolean
  }

  const id = Number(body.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Option id is required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (typeof body.label === 'string') patch.label = body.label.trim()
  if (typeof body.value === 'string') patch.value = body.value.trim()
  if (Number.isFinite(Number(body.sort_order))) patch.sort_order = Number(body.sort_order)
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes submitted' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_info_field_option_catalog' as never)
    .update(patch as never)
    .eq('id' as never, id as never)
    .select('id, field_id, label, value, sort_order, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ option: data })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiRoles(['admin'])
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id') || '')
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Option id is required' }, { status: 400 })

  const { error } = await supabase
    .from('project_info_field_option_catalog' as never)
    .update({ is_active: false } as never)
    .eq('id' as never, id as never)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
