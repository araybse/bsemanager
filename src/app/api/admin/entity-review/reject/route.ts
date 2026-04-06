import { NextResponse } from 'next/server'
import { rejectMatch } from '@/lib/phase2/entity-resolver'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { matchId, reason } = body
    
    if (!matchId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: matchId' },
        { status: 400 }
      )
    }
    
    await rejectMatch(matchId, reason)
    
    return NextResponse.json({
      success: true,
      message: 'Match rejected successfully'
    })
  } catch (error) {
    console.error('Error rejecting match:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to reject match' },
      { status: 500 }
    )
  }
}
