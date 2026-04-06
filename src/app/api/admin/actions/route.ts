import { NextResponse } from 'next/server'
import { getActionsByStatus, type ActionStatus } from '@/lib/phase2/action-state-machine'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as ActionStatus | null
    const ownerId = searchParams.get('ownerId') || undefined
    const assigneeId = searchParams.get('assigneeId') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    const actions = await getActionsByStatus(status || undefined, {
      ownerId,
      assigneeId,
      limit,
      offset
    })
    
    return NextResponse.json({
      success: true,
      data: actions,
      count: actions.length
    })
  } catch (error) {
    console.error('Error fetching actions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch actions' },
      { status: 500 }
    )
  }
}
