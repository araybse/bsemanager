import { NextRequest, NextResponse } from 'next/server'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await requireApiRoles(['admin', 'project_manager', 'employee'])
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()

  const formData = await request.formData()
  const requiredItemCatalogId = Number(formData.get('requiredItemCatalogId') || '')
  const file = formData.get('file')

  if (!Number.isFinite(requiredItemCatalogId)) {
    return NextResponse.json({ error: 'requiredItemCatalogId is required' }, { status: 400 })
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'PDF file is required' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
  }

  const { data: requiredItem, error: requiredItemError } = await supabase
    .from('permit_required_item_catalog' as never)
    .select('id, permit_id, code, name, item_type, application_template_id')
    .eq('id' as never, requiredItemCatalogId as never)
    .maybeSingle()

  if (requiredItemError || !requiredItem) {
    return NextResponse.json(
      { error: requiredItemError?.message || 'Permit document not found' },
      { status: 404 }
    )
  }
  const requiredItemRow = requiredItem as {
    id: number
    permit_id: number
    code: string
    name: string
    item_type: string
    application_template_id: number | null
  }
  if (requiredItemRow.item_type !== 'application') {
    return NextResponse.json(
      { error: 'Templates can only be uploaded for application-type permit documents' },
      { status: 400 }
    )
  }

  const { data: permit, error: permitError } = await supabase
    .from('permit_catalog' as never)
    .select('id, agency_id')
    .eq('id' as never, requiredItemRow.permit_id as never)
    .maybeSingle()
  if (permitError || !permit) {
    return NextResponse.json({ error: permitError?.message || 'Permit not found' }, { status: 404 })
  }
  const permitRow = permit as { id: number; agency_id: number }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const bucket = 'application-templates'
  const fileName = file.name.toLowerCase().endsWith('.pdf') ? file.name : `${file.name}.pdf`
  const storagePath = `required-item-${requiredItemRow.id}/${Date.now()}-${fileName}`

  const existingTemplateId = Number(requiredItemRow.application_template_id) || null
  if (existingTemplateId) {
    const { data: existingTemplate } = await supabase
      .from('application_template_catalog' as never)
      .select('storage_bucket, storage_path')
      .eq('id' as never, existingTemplateId as never)
      .maybeSingle()

    const oldBucket = (existingTemplate as { storage_bucket?: string } | null)?.storage_bucket || bucket
    const oldPath = (existingTemplate as { storage_path?: string | null } | null)?.storage_path || null
    if (oldPath) {
      await supabase.storage.from(oldBucket).remove([oldPath])
    }
  }

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  let templateId = existingTemplateId
  if (templateId) {
    const { error: updateTemplateError } = await supabase
      .from('application_template_catalog' as never)
      .update(
        {
          agency_id: permitRow.agency_id,
          permit_id: permitRow.id,
          name: `${requiredItemRow.name}`,
          storage_bucket: bucket,
          storage_path: storagePath,
          updated_at: new Date().toISOString(),
          is_active: true,
        } as never
      )
      .eq('id' as never, templateId as never)
    if (updateTemplateError) {
      return NextResponse.json({ error: updateTemplateError.message }, { status: 500 })
    }
  } else {
    const { data: insertedTemplate, error: insertTemplateError } = await supabase
      .from('application_template_catalog' as never)
      .insert(
        {
          agency_id: permitRow.agency_id,
          permit_id: permitRow.id,
          code: `PRI_${requiredItemRow.id}`,
          name: `${requiredItemRow.name}`,
          storage_bucket: bucket,
          storage_path: storagePath,
          output_mime_type: 'application/pdf',
          is_active: true,
        } as never
      )
      .select('id')
      .single()
    if (insertTemplateError || !insertedTemplate) {
      return NextResponse.json(
        { error: insertTemplateError?.message || 'Failed to create template record' },
        { status: 500 }
      )
    }
    templateId = (insertedTemplate as { id: number }).id
  }

  const { error: linkError } = await supabase
    .from('permit_required_item_catalog' as never)
    .update({ application_template_id: templateId, updated_at: new Date().toISOString() } as never)
    .eq('id' as never, requiredItemCatalogId as never)
  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 })
  }

  return NextResponse.json({
    templateId,
    storagePath,
    storageBucket: bucket,
  })
}
