import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'
import { drainageCalculationSchema } from '@/lib/cam/contracts'
import { persistDrainageCalculation, runDrainageCalculation } from '@/lib/cam/drainage-engine'
import { insertCamSyncEvent } from '@/lib/cam/sync'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const payload = drainageCalculationSchema.parse(await request.json())
    const outputs = runDrainageCalculation(payload)
    const supabase = createAdminClient()
    const run = await persistDrainageCalculation(
      supabase,
      payload,
      outputs,
      auth.user.email || auth.user.id
    )

    await insertCamSyncEvent(supabase, {
      projectId: payload.projectId,
      sourceSystem: 'drainage_engine',
      targetSystem: 'supabase',
      entityTable: 'drainage_calculations',
      eventType: 'ingest',
      status: outputs.calcStatus === 'failed' ? 'failed' : 'success',
      requestPayload: payload,
      responsePayload: { run_id: (run as { id: number } | null)?.id || null, outputs },
    })

    return NextResponse.json({ success: true, run, outputs })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run drainage calculations' },
      { status: 500 }
    )
  }
}
