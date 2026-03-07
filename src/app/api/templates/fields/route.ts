import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireApiRoles(['admin', 'project_manager', 'employee'])
  if (!auth.ok) return auth.response

  const templateId = Number(request.nextUrl.searchParams.get('template_id') || '')
  if (!Number.isFinite(templateId)) {
    return NextResponse.json({ error: 'template_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: template, error: templateError } = await supabase
    .from('application_template_catalog' as never)
    .select('id, storage_bucket, storage_path, is_active')
    .eq('id' as never, templateId as never)
    .maybeSingle()
  if (templateError || !template) {
    return NextResponse.json({ error: templateError?.message || 'Template not found' }, { status: 404 })
  }

  const bucket = (template as { storage_bucket?: string }).storage_bucket || 'application-templates'
  const path = (template as { storage_path?: string | null }).storage_path || null
  if (!path) {
    return NextResponse.json({ fields: [] as string[] })
  }

  const { data: fileData, error: downloadError } = await supabase.storage.from(bucket).download(path)
  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: downloadError?.message || 'Failed to download template file' },
      { status: 500 }
    )
  }

  const pdfBytes = new Uint8Array(await fileData.arrayBuffer())
  const pdfDoc = await PDFDocument.load(pdfBytes)

  let fields: string[] = []
  try {
    const form = pdfDoc.getForm()
    fields = form.getFields().map((field) => field.getName())
  } catch {
    fields = []
  }

  const uniqueFields = Array.from(new Set(fields)).sort((a, b) => a.localeCompare(b))
  return NextResponse.json({ fields: uniqueFields })
}
