import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { computeDataQualityChecks } from '@/lib/data-quality/checks'

export async function GET() {
  try {
    const auth = await requireApiRoles(['admin', 'project_manager'])
    if (!auth.ok) return auth.response

    const supabase = createAdminClient()
    const checks = await computeDataQualityChecks(supabase)

    return NextResponse.json({
      checks,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute data quality checks' },
      { status: 500 }
    )
  }
}
