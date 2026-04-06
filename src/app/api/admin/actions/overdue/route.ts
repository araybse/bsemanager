import { NextResponse } from 'next/server'
import { getOverdueActions } from '@/lib/phase2/action-state-machine'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const actions = await getOverdueActions(limit)
    
    return NextResponse.json({
      success: true,
      data: actions,
      count: actions.length
    })
  } catch (error) {
    console.error('Error fetching overdue actions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch overdue actions' },
      { status: 500 }
    )
  }
}
