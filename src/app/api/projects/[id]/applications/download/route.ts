import { NextRequest, NextResponse } from 'next/server'
import { PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField, PDFDocument } from 'pdf-lib'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const isTruthy = (value: string) => /^(true|1|yes|y|x|checked)$/i.test(value.trim())

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(['admin', 'project_manager', 'employee', 'client'])
  if (!auth.ok) return auth.response

  const params = await context.params
  const projectId = Number(params.id)
  const runId = Number(request.nextUrl.searchParams.get('run_id') || '')

  if (!Number.isFinite(projectId) || !Number.isFinite(runId)) {
    return NextResponse.json({ error: 'Invalid project or run id' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: run, error: runError } = await supabase
    .from('project_application_runs' as never)
    .select('id, project_id, template_id, resolved_fields, created_at')
    .eq('id' as never, runId as never)
    .eq('project_id' as never, projectId as never)
    .maybeSingle()

  if (runError || !run) {
    return NextResponse.json({ error: runError?.message || 'Run not found' }, { status: 404 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('project_number, name')
    .eq('id', projectId as never)
    .maybeSingle()

  const { data: template } = await supabase
    .from('application_template_catalog' as never)
    .select('code, name, storage_bucket, storage_path')
    .eq('id' as never, (run as { template_id: number | null }).template_id as never)
    .maybeSingle()

  const storageBucket =
    (template as { storage_bucket?: string } | null)?.storage_bucket || 'application-templates'
  const storagePath = (template as { storage_path?: string | null } | null)?.storage_path || null

  if (!storagePath) {
    return NextResponse.json({ error: 'Template file is not linked for this run' }, { status: 400 })
  }

  const { data: templateFile, error: downloadTemplateError } = await supabase.storage
    .from(storageBucket)
    .download(storagePath)
  if (downloadTemplateError || !templateFile) {
    return NextResponse.json(
      { error: downloadTemplateError?.message || 'Failed to download template PDF' },
      { status: 500 }
    )
  }

  const templateBytes = new Uint8Array(await templateFile.arrayBuffer())
  const pdfDoc = await PDFDocument.load(templateBytes)
  const form = pdfDoc.getForm()
  const fieldByName = new Map(form.getFields().map((field) => [field.getName(), field]))

  const resolvedFields = (run as { resolved_fields: Record<string, unknown> | null }).resolved_fields || {}
  Object.entries(resolvedFields).forEach(([fieldName, rawValue]) => {
    const field = fieldByName.get(fieldName)
    if (!field) return
    const value = String(rawValue ?? '')
    try {
      if (field instanceof PDFTextField) {
        field.setText(value)
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList || field instanceof PDFRadioGroup) {
        if (value) field.select(value)
      } else if (field instanceof PDFCheckBox) {
        if (isTruthy(value)) field.check()
        else field.uncheck()
      }
    } catch {
      // Keep processing remaining fields when one mapping doesn't match control type/options.
    }
  })

  const filledPdfBytes = await pdfDoc.save()
  const templateCode = (template as { code?: string } | null)?.code || 'APPLICATION'
  const projectNumber = (project as { project_number?: string } | null)?.project_number || 'PROJECT'
  const fileName = `${projectNumber}_${templateCode}_RUN_${runId}.pdf`

  return new NextResponse(Buffer.from(filledPdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
