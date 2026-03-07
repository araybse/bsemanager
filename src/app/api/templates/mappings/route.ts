import { NextRequest, NextResponse } from 'next/server'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

type MappingPayload = {
  pdf_field_name: string
  canonical_key: string
  transform_rule?: string | null
  fallback_value?: string | null
  sort_order?: number | null
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRoles(['admin', 'project_manager', 'employee'])
  if (!auth.ok) return auth.response

  const templateId = Number(request.nextUrl.searchParams.get('template_id') || '')
  if (!Number.isFinite(templateId)) {
    return NextResponse.json({ error: 'template_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('application_field_map' as never)
    .select('id, template_id, pdf_field_name, canonical_key, transform_rule, fallback_value, sort_order')
    .eq('template_id' as never, templateId as never)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ mappings: data || [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRoles(['admin', 'project_manager', 'employee'])
  if (!auth.ok) return auth.response

  let body: { templateId?: number; mappings?: MappingPayload[] } = {}
  try {
    body = (await request.json()) as { templateId?: number; mappings?: MappingPayload[] }
  } catch {
    body = {}
  }

  const templateId = Number(body.templateId || '')
  if (!Number.isFinite(templateId)) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error: deleteError } = await supabase
    .from('application_field_map' as never)
    .delete()
    .eq('template_id' as never, templateId as never)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  const rowsToInsert = ((body.mappings || []) as MappingPayload[])
    .map((mapping, index) => ({
      template_id: templateId,
      pdf_field_name: (mapping.pdf_field_name || '').trim(),
      canonical_key: (mapping.canonical_key || '').trim(),
      transform_rule: (mapping.transform_rule || '').trim() || null,
      fallback_value: (mapping.fallback_value || '').trim() || null,
      sort_order: Number(mapping.sort_order) || index + 1,
    }))
    .filter((mapping) => mapping.pdf_field_name && mapping.canonical_key)

  const seenFieldNames = new Set<string>()
  for (const row of rowsToInsert) {
    const key = row.pdf_field_name.toLowerCase()
    if (seenFieldNames.has(key)) {
      return NextResponse.json(
        { error: `Duplicate PDF field mapping detected: ${row.pdf_field_name}` },
        { status: 400 }
      )
    }
    seenFieldNames.add(key)

    const canonicalKey = row.canonical_key
    const isKnownPrefix =
      canonicalKey.startsWith('projectInfo.') ||
      canonicalKey.startsWith('project.') ||
      canonicalKey.startsWith('bseInfo.')
    if (!isKnownPrefix) {
      return NextResponse.json(
        { error: `Unknown canonical key: ${canonicalKey}` },
        { status: 400 }
      )
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('application_field_map' as never)
      .insert(rowsToInsert as never)
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ saved: rowsToInsert.length })
}
