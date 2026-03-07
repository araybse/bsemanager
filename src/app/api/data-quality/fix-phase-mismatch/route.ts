import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'

type FixPayload = {
  line_item_id: number
  new_phase_name: string
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRoles(['admin', 'project_manager'])
    if (!auth.ok) return auth.response

    const body = await request.json()
    const fixesRaw: FixPayload[] = Array.isArray(body?.fixes)
      ? body.fixes
      : [{ line_item_id: Number(body?.line_item_id), new_phase_name: body?.new_phase_name }]
    const fixes = fixesRaw
      .map((item) => ({
        line_item_id: Number(item.line_item_id),
        new_phase_name: (item.new_phase_name || '').toString().trim(),
      }))
      .filter((item) => item.line_item_id > 0 && item.new_phase_name.length > 0)

    if (!fixes.length) {
      return NextResponse.json(
        { error: 'Provide line_item_id/new_phase_name or fixes[]' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const results: Array<{ line_item_id: number; status: 'updated' | 'unchanged' | 'skipped'; reason?: string }> = []

    for (const fix of fixes) {
      const { data, error: lineItemError } = await supabase
        .from('invoice_line_items')
        .select('id, project_number, invoice_number, phase_name, line_type')
        .eq('id' as never, fix.line_item_id as never)
        .single()
      const lineItem = data as
        | {
            id: number
            project_number: string | null
            invoice_number: string | null
            phase_name: string | null
            line_type: string | null
          }
        | null
      if (lineItemError || !lineItem) {
        results.push({ line_item_id: fix.line_item_id, status: 'skipped', reason: 'not_found' })
        continue
      }

      if ((lineItem.line_type || '').toLowerCase() === 'reimbursable') {
        results.push({ line_item_id: fix.line_item_id, status: 'skipped', reason: 'reimbursable' })
        continue
      }
      if ((lineItem.line_type || '').toLowerCase() === 'adjustment') {
        results.push({ line_item_id: fix.line_item_id, status: 'skipped', reason: 'adjustment' })
        continue
      }

      const oldPhaseName = (lineItem.phase_name || '').toString()
      if (oldPhaseName.trim() === fix.new_phase_name) {
        results.push({ line_item_id: fix.line_item_id, status: 'unchanged' })
        continue
      }

      const { error: updateError } = await supabase
        .from('invoice_line_items')
        .update({ phase_name: fix.new_phase_name } as never)
        .eq('id' as never, fix.line_item_id as never)
      if (updateError) {
        results.push({ line_item_id: fix.line_item_id, status: 'skipped', reason: 'update_error' })
        continue
      }

      await supabase.from('data_quality_fix_log').insert({
        fix_type: 'phase_mismatch',
        line_item_id: lineItem.id,
        invoice_number: lineItem.invoice_number,
        project_number: lineItem.project_number,
        old_phase_name: oldPhaseName,
        new_phase_name: fix.new_phase_name,
        changed_by: auth.user.id,
        changed_by_email: auth.user.email || null,
      } as never)

      results.push({ line_item_id: fix.line_item_id, status: 'updated' })
    }

    const updated = results.filter((row) => row.status === 'updated').length
    const unchanged = results.filter((row) => row.status === 'unchanged').length
    const skipped = results.filter((row) => row.status === 'skipped').length

    return NextResponse.json({
      ok: true,
      summary: { total: results.length, updated, unchanged, skipped },
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fix phase mismatch' },
      { status: 500 }
    )
  }
}
