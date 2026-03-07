import { NextRequest, NextResponse } from 'next/server'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyTransformRule, resolveCanonicalValue } from '@/lib/applications/canonical-fields'

export const runtime = 'nodejs'

type GenerateRequestBody = {
  requiredItemId?: number
  templateId?: number
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(['admin', 'project_manager', 'employee'])
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const params = await context.params
  const projectId = Number(params.id)
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
  }

  let body: GenerateRequestBody
  try {
    body = (await request.json()) as GenerateRequestBody
  } catch {
    body = {}
  }

  if (!body.requiredItemId) {
    return NextResponse.json({ error: 'requiredItemId is required' }, { status: 400 })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, project_number, name')
    .eq('id', projectId as never)
    .maybeSingle()
  if (projectError || !project) {
    return NextResponse.json({ error: projectError?.message || 'Project not found' }, { status: 404 })
  }

  const { data: projectInfo } = await supabase
    .from('project_info' as never)
    .select('*')
    .eq('project_id' as never, projectId as never)
    .maybeSingle()

  const { data: bseInfo } = await supabase
    .from('bse_info' as never)
    .select('*')
    .limit(1)
    .maybeSingle()

  const { data: projectInfoFields } = await supabase
    .from('project_info_field_catalog' as never)
    .select('id, column_name, value_mode, is_active')
    .eq('is_active' as never, true as never)

  const multiValueFieldIds = ((projectInfoFields || []) as Array<{
    id: number
    column_name: string
    value_mode: 'scalar' | 'multi' | null
  }>)
    .filter((field) => (field.value_mode || 'scalar') === 'multi')
    .map((field) => field.id)

  const projectInfoMultiByColumn: Record<string, string[]> = {}
  if (multiValueFieldIds.length > 0) {
    const { data: projectInfoFieldValues } = await supabase
      .from('project_info_field_values' as never)
      .select('field_id, value, sort_order')
      .eq('project_id' as never, projectId as never)
      .eq('is_active' as never, true as never)
      .in('field_id' as never, multiValueFieldIds as never)
      .order('field_id', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })

    const fieldById = new Map<number, string>()
    ;((projectInfoFields || []) as Array<{ id: number; column_name: string }>).forEach((field) =>
      fieldById.set(field.id, field.column_name)
    )

    ;((projectInfoFieldValues || []) as Array<{ field_id: number; value: string | null }>).forEach((row) => {
      const columnName = fieldById.get(row.field_id)
      if (!columnName) return
      const current = projectInfoMultiByColumn[columnName] || []
      const nextValue = String(row.value || '').trim()
      if (!nextValue) return
      current.push(nextValue)
      projectInfoMultiByColumn[columnName] = current
    })
  }

  const { data: requiredItem, error: requiredItemError } = await supabase
    .from('project_required_items' as never)
    .select(
      'id, project_id, project_permit_selection_id, required_item_catalog_id, name, item_type, responsibility'
    )
    .eq('id' as never, body.requiredItemId as never)
    .eq('project_id' as never, projectId as never)
    .maybeSingle()

  if (requiredItemError || !requiredItem) {
    return NextResponse.json(
      { error: requiredItemError?.message || 'Required item not found' },
      { status: 404 }
    )
  }

  let templateId = body.templateId || null
  if (!templateId && requiredItem.required_item_catalog_id) {
    const { data: requiredCatalog } = await supabase
      .from('permit_required_item_catalog' as never)
      .select('application_template_id')
      .eq('id' as never, requiredItem.required_item_catalog_id as never)
      .maybeSingle()
    templateId = Number((requiredCatalog as { application_template_id: number | null } | null)?.application_template_id) || null
  }

  if (!templateId) {
    return NextResponse.json(
      { error: 'No template linked to this required item. Configure template mapping first.' },
      { status: 400 }
    )
  }

  const { data: template, error: templateError } = await supabase
    .from('application_template_catalog' as never)
    .select('id, code, name')
    .eq('id' as never, templateId as never)
    .maybeSingle()
  if (templateError || !template) {
    return NextResponse.json({ error: templateError?.message || 'Template not found' }, { status: 404 })
  }

  const { data: mappings, error: mappingsError } = await supabase
    .from('application_field_map' as never)
    .select('id, pdf_field_name, canonical_key, transform_rule, fallback_value, sort_order')
    .eq('template_id' as never, templateId as never)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (mappingsError) {
    return NextResponse.json({ error: mappingsError.message }, { status: 500 })
  }

  const resolvedFields: Record<string, string> = {}
  ;((mappings as Array<{
    pdf_field_name: string
    canonical_key: string
    transform_rule: string | null
    fallback_value: string | null
  }> | null) || []).forEach((mapping) => {
    const canonicalValue = resolveCanonicalValue(
      {
        project: project as unknown as Record<string, unknown>,
        projectInfo: (projectInfo as Record<string, unknown> | null) || null,
        bseInfo: (bseInfo as Record<string, unknown> | null) || null,
        projectInfoMultiByColumn,
      },
      mapping.canonical_key || ''
    )
    const value = canonicalValue || mapping.fallback_value || ''
    resolvedFields[mapping.pdf_field_name] = applyTransformRule(value, mapping.transform_rule)
  })

  const { data: insertedRun, error: insertRunError } = await supabase
    .from('project_application_runs' as never)
    .insert(
      {
        project_id: projectId,
        project_permit_selection_id: requiredItem.project_permit_selection_id,
        required_item_id: requiredItem.id,
        template_id: templateId,
        status: 'completed',
        resolved_fields: resolvedFields,
        created_by: auth.user.id,
      } as never
    )
    .select('id')
    .single()

  if (insertRunError || !insertedRun) {
    return NextResponse.json({ error: insertRunError?.message || 'Failed to create run' }, { status: 500 })
  }

  const downloadUrl = `/api/projects/${projectId}/applications/download?run_id=${insertedRun.id}`

  const { error: updateRunError } = await supabase
    .from('project_application_runs' as never)
    .update(
      {
        generated_file_url: downloadUrl,
        generated_file_path: `virtual/${insertedRun.id}.pdf`,
        updated_at: new Date().toISOString(),
      } as never
    )
    .eq('id' as never, insertedRun.id as never)

  if (updateRunError) {
    return NextResponse.json({ error: updateRunError.message }, { status: 500 })
  }

  const generatedFileName = `${(project.project_number || 'PROJECT').toString()}_${(template.code || 'APPLICATION').toString()}_RUN_${insertedRun.id}.pdf`

  await supabase.from('generated_application_files' as never).insert({
    project_id: projectId,
    run_id: insertedRun.id,
    template_id: templateId,
    file_name: generatedFileName,
    storage_bucket: 'virtual-generated',
    storage_path: `virtual/${insertedRun.id}.pdf`,
    public_url: downloadUrl,
    mime_type: 'application/pdf',
  } as never)

  await supabase
    .from('project_required_items' as never)
    .update({ status: 'generated', output_file_url: downloadUrl, updated_at: new Date().toISOString() } as never)
    .eq('id' as never, requiredItem.id as never)

  return NextResponse.json({
    runId: insertedRun.id,
    downloadUrl,
    fileName: generatedFileName,
    resolvedFieldCount: Object.keys(resolvedFields).length,
  })
}
