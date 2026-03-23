import { NextRequest, NextResponse } from 'next/server'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
const PROJECT_INFO_SCHEMA_EDITORS = ['aburke@blackstoneeng.com']

const toCode = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')

export async function POST(request: NextRequest) {
  const auth = await requireApiRoles(['admin'], PROJECT_INFO_SCHEMA_EDITORS)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    code?: string
    sort_order?: number
  }

  const title = String(body.title || '').trim()
  const code = toCode(String(body.code || title))
  const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100

  if (!title) {
    return NextResponse.json({ error: 'Section title is required' }, { status: 400 })
  }
  if (!code) {
    return NextResponse.json({ error: 'Section code is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_info_section_catalog' as never)
    .insert({ title, code, sort_order: sortOrder, is_active: true } as never)
    .select('id, code, title, sort_order, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ section: data })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiRoles(['admin'], PROJECT_INFO_SCHEMA_EDITORS)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const body = (await request.json().catch(() => ({}))) as {
    id?: number
    title?: string
    code?: string
    sort_order?: number
    is_active?: boolean
  }
  const id = Number(body.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Section id is required' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.title === 'string') patch.title = body.title.trim()
  if (typeof body.code === 'string') patch.code = toCode(body.code)
  if (Number.isFinite(Number(body.sort_order))) patch.sort_order = Number(body.sort_order)
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes submitted' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_info_section_catalog' as never)
    .update(patch as never)
    .eq('id' as never, id as never)
    .select('id, code, title, sort_order, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ section: data })
}
