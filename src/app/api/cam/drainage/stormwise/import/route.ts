import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'
import { insertCamSyncEvent } from '@/lib/cam/sync'

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim())
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = cells[idx] || ''
    })
    return row
  })
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const body = (await request.json()) as {
      projectId: number
      csv: string
      modelVendor?: string
    }
    if (!body.projectId || !body.csv) {
      return NextResponse.json({ error: 'projectId and csv are required' }, { status: 400 })
    }

    const rows = parseCsv(body.csv)
    const supabase = createAdminClient()
    const { error } = await supabase.from('drainage_model_exchange').insert({
      project_id: body.projectId,
      model_vendor: body.modelVendor || 'stormwise',
      exchange_direction: 'import',
      exchange_payload: { rows } as never,
      status: 'success',
    } as never)
    if (error) throw error

    await insertCamSyncEvent(supabase, {
      projectId: body.projectId,
      sourceSystem: body.modelVendor || 'stormwise',
      targetSystem: 'supabase',
      entityTable: 'drainage_model_exchange',
      eventType: 'ingest',
      status: 'success',
      requestPayload: { row_count: rows.length },
      responsePayload: { imported: rows.length },
    })

    return NextResponse.json({ success: true, importedRows: rows.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed StormWise import' },
      { status: 500 }
    )
  }
}
