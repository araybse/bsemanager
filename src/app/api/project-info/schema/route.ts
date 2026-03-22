import { NextResponse } from 'next/server'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRoles(['admin', 'project_manager', 'employee'])
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()

  const { data: sections, error: sectionError } = await supabase
    .from('project_info_section_catalog' as never)
    .select('id, code, title, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (sectionError) {
    console.error('[project-info/schema] section query failed:', sectionError.message)
    return NextResponse.json({
      sections: [],
      fields: [],
      options: [],
      error: sectionError.message,
    })
  }

  const { data: fieldsWithSystem, error: fieldError } = await supabase
    .from('project_info_field_catalog' as never)
    .select(
      'id, section_id, label, description, column_name, canonical_key, input_type, source_type, value_mode, sort_order, is_active, is_system'
    )
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  let fields = fieldsWithSystem || []
  if (fieldError) {
    // Backward-compat: some environments may not have is_system and/or description yet.
    const { data: fieldsWithoutSystem, error: fallbackFieldError } = await supabase
      .from('project_info_field_catalog' as never)
      .select(
        'id, section_id, label, description, column_name, canonical_key, input_type, source_type, value_mode, sort_order, is_active'
      )
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
    if (fallbackFieldError) {
      const { data: legacyFields, error: legacyFieldError } = await supabase
        .from('project_info_field_catalog' as never)
        .select('id, section_id, label, column_name, canonical_key, input_type, source_type, sort_order, is_active')
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true })
      if (legacyFieldError) {
        console.error('[project-info/schema] field query failed:', legacyFieldError.message)
        return NextResponse.json({
          sections: sections || [],
          fields: [],
          options: [],
          error: legacyFieldError.message,
        })
      }
      fields = (legacyFields || []).map((row) => ({
        ...(row as Record<string, unknown>),
        description: null,
        value_mode: 'scalar',
        is_system: false,
      })) as typeof fields
    } else {
      fields = (fieldsWithoutSystem || []).map((row) => ({
        ...(row as Record<string, unknown>),
        description: (row as { description?: string | null }).description || null,
        value_mode: (row as { value_mode?: string | null }).value_mode || 'scalar',
        is_system: false,
      })) as typeof fields
    }
  }

  const { data: options, error: optionError } = await supabase
    .from('project_info_field_option_catalog' as never)
    .select('id, field_id, label, value, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (optionError) {
    console.error('[project-info/schema] option query failed:', optionError.message)
    return NextResponse.json({
      sections: sections || [],
      fields: fields || [],
      options: [],
      error: optionError.message,
    })
  }

  return NextResponse.json({
    sections: sections || [],
    fields: fields || [],
    options: options || [],
  })
}
