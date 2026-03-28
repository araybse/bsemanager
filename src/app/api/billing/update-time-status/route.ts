import { NextResponse } from 'next/server'
import { updateTimeBilledStatus } from '@/lib/billing/update-time-billed-status'

/**
 * POST /api/billing/update-time-status
 * 
 * Updates time entry billed status based on invoice billing periods
 * This should be called after invoice sync completes
 */
export async function POST() {
  try {
    const result = await updateTimeBilledStatus()
    
    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Error updating time billed status:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to update time entry billed status',
    endpoint: '/api/billing/update-time-status',
    method: 'POST'
  })
}
