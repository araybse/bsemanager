import { NextResponse } from 'next/server'
import { changeActionStatus, type ActionStatus } from '@/lib/phase2/action-state-machine'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { newStatus, evidence, changedBy } = body
    
    if (!newStatus) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: newStatus' },
        { status: 400 }
      )
    }
    
    const result = await changeActionStatus(
      params.id,
      newStatus as ActionStatus,
      evidence,
      changedBy || 'system'
    )
    
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error updating action status:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update action status' },
      { status: 500 }
    )
  }
}
