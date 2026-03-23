import { NextRequest, NextResponse } from 'next/server'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const VALID_TYPES = new Set(['text', 'textarea', 'select', 'date', 'phone', 'number'])
const VALID_SOURCES = new Set(['static', 'project_managers', 'engineers', 'city_county'])
const VALID_VALUE_MODES = new Set(['scalar', 'multi'])
const PROJECT_INFO_SCHEMA_EDITORS = ['aburke@blackstoneeng.com']

const toColumn = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')

const parseMultiValues = (raw: string | null | undefined) =>
  String(raw || '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)

export async function POST(request: NextRequest) {
  const auth = await requireApiRoles(['admin'], PROJECT_INFO_SCHEMA_EDITORS)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const body = (await request.json().catch(() => ({}))) as {
    section_id?: number
    label?: string
    description?: string | null
    column_name?: string
    input_type?: string
    source_type?: string | null
    value_mode?: string
    sort_order?: number
  }

  const sectionId = Number(body.section_id)
  const label = String(body.label || '').trim()
  const description = body.description === undefined ? null : String(body.description || '').trim() || null
  const columnName = toColumn(String(body.column_name || ''))
  const inputType = String(body.input_type || 'text').trim().toLowerCase()
  const sourceType = body.source_type ? String(body.source_type).trim().toLowerCase() : null
  const valueMode = String(body.value_mode || 'scalar').trim().toLowerCase()
  const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100

  if (!Number.isFinite(sectionId)) {
    return NextResponse.json({ error: 'section_id is required' }, { status: 400 })
  }
  if (!label) return NextResponse.json({ error: 'Field label is required' }, { status: 400 })
  if (!columnName) return NextResponse.json({ error: 'column_name is required' }, { status: 400 })
  if (!VALID_TYPES.has(inputType)) {
    return NextResponse.json({ error: 'Invalid input_type' }, { status: 400 })
  }
  if (sourceType && !VALID_SOURCES.has(sourceType)) {
    return NextResponse.json({ error: 'Invalid source_type' }, { status: 400 })
  }
  if (!VALID_VALUE_MODES.has(valueMode)) {
    return NextResponse.json({ error: 'Invalid value_mode' }, { status: 400 })
  }

  const { data: existingField, error: existingFieldError } = await supabase
    .from('project_info_field_catalog' as never)
    .select('id, label, section_id, is_active')
    .eq('column_name' as never, columnName as never)
    .maybeSingle()
  if (existingFieldError) {
    return NextResponse.json({ error: existingFieldError.message }, { status: 500 })
  }
  if (existingField) {
    const field = existingField as {
      id: number
      label: string
      section_id: number
      is_active: boolean
    }
    const statusLabel = field.is_active ? 'active' : 'inactive'
    return NextResponse.json(
      {
        error: `Column "${columnName}" is already used by field "${field.label}" (section ${field.section_id}, ${statusLabel}). Use a different column_name or update/reactivate the existing field.`,
      },
      { status: 409 }
    )
  }

  const { error: rpcError } = await supabase.rpc('add_project_info_column' as never, {
    p_column_name: columnName,
  } as never)
  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })

  const { data, error } = await supabase
    .from('project_info_field_catalog' as never)
    .insert(
      {
        section_id: sectionId,
        label,
        description,
        column_name: columnName,
        input_type: inputType,
        source_type: sourceType,
        value_mode: valueMode,
        sort_order: sortOrder,
        is_active: true,
        is_system: false,
      } as never
    )
    .select(
      'id, section_id, label, description, column_name, canonical_key, input_type, source_type, value_mode, sort_order, is_active, is_system'
    )
    .single()

  if (error) {
    const isDuplicateColumn = (error as { code?: string; message?: string }).code === '23505'
      || (error as { message?: string }).message?.includes(
        'project_info_field_catalog_column_name_unique'
      )
    if (isDuplicateColumn) {
      return NextResponse.json(
        {
          error: `Column "${columnName}" already exists. Choose a different column_name.`,
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ field: data })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiRoles(['admin'], PROJECT_INFO_SCHEMA_EDITORS)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const body = (await request.json().catch(() => ({}))) as {
    id?: number
    section_id?: number
    label?: string
    description?: string | null
    column_name?: string
    input_type?: string
    source_type?: string | null
    value_mode?: string
    sort_order?: number
    is_active?: boolean
  }
  const id = Number(body.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Field id is required' }, { status: 400 })

  const { data: existing, error: existingError } = await supabase
    .from('project_info_field_catalog' as never)
    .select('id, column_name, value_mode')
    .eq('id' as never, id as never)
    .maybeSingle()
  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message || 'Field not found' }, { status: 404 })
  }
  const existingField = existing as { id: number; column_name: string; value_mode?: string | null }

  const patch: Record<string, unknown> = {}
  if (Number.isFinite(Number(body.section_id))) patch.section_id = Number(body.section_id)
  if (typeof body.label === 'string') patch.label = body.label.trim()
  if (body.description !== undefined) patch.description = String(body.description || '').trim() || null
  if (Number.isFinite(Number(body.sort_order))) patch.sort_order = Number(body.sort_order)
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
  if (typeof body.input_type === 'string') {
    const inputType = body.input_type.trim().toLowerCase()
    if (!VALID_TYPES.has(inputType)) {
      return NextResponse.json({ error: 'Invalid input_type' }, { status: 400 })
    }
    patch.input_type = inputType
  }
  if (body.source_type !== undefined) {
    const source = body.source_type ? String(body.source_type).trim().toLowerCase() : null
    if (source && !VALID_SOURCES.has(source)) {
      return NextResponse.json({ error: 'Invalid source_type' }, { status: 400 })
    }
    patch.source_type = source
  }
  const nextValueMode =
    body.value_mode !== undefined ? String(body.value_mode || '').trim().toLowerCase() : null
  if (nextValueMode !== null) {
    if (!VALID_VALUE_MODES.has(nextValueMode)) {
      return NextResponse.json({ error: 'Invalid value_mode' }, { status: 400 })
    }
    patch.value_mode = nextValueMode
  }
  if (typeof body.column_name === 'string' && body.column_name.trim()) {
    const proposed = toColumn(body.column_name)
    if (proposed !== existingField.column_name) {
      return NextResponse.json(
        { error: 'column_name is immutable after field creation' },
        { status: 400 }
      )
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes submitted' }, { status: 400 })
  }

  const currentValueMode = String(existingField.value_mode || 'scalar').toLowerCase()
  if (nextValueMode === 'multi' && currentValueMode !== 'multi') {
    const columnName = existingField.column_name
    const { data: projectRows, error: projectRowsError } = await supabase
      .from('project_info' as never)
      .select(`project_id,${columnName}`)
      .not(columnName as never, 'is' as never, null as never)
    if (projectRowsError) {
      return NextResponse.json({ error: projectRowsError.message }, { status: 500 })
    }

    const inserts: Array<{ project_id: number; field_id: number; value: string; sort_order: number; is_active: boolean }> = []
    ;((projectRows as Array<Record<string, unknown>> | null) || []).forEach((row) => {
      const projectId = Number(row.project_id)
      if (!Number.isFinite(projectId)) return
      const values = parseMultiValues(String(row[columnName] || ''))
      values.forEach((value, index) => {
        inserts.push({
          project_id: projectId,
          field_id: id,
          value,
          sort_order: index + 1,
          is_active: true,
        })
      })
    })

    const { error: deleteExistingMultiError } = await supabase
      .from('project_info_field_values' as never)
      .delete()
      .eq('field_id' as never, id as never)
    if (deleteExistingMultiError) {
      return NextResponse.json({ error: deleteExistingMultiError.message }, { status: 500 })
    }

    if (inserts.length) {
      const { error: insertMultiError } = await supabase
        .from('project_info_field_values' as never)
        .insert(inserts as never)
      if (insertMultiError) {
        return NextResponse.json({ error: insertMultiError.message }, { status: 500 })
      }
    }
  }

  const { data, error } = await supabase
    .from('project_info_field_catalog' as never)
    .update(patch as never)
    .eq('id' as never, id as never)
    .select(
      'id, section_id, label, description, column_name, canonical_key, input_type, source_type, value_mode, sort_order, is_active, is_system'
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ field: data })
}
