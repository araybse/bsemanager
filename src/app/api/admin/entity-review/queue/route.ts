import { NextResponse } from 'next/server'
import { getPendingReviews } from '@/lib/phase2/entity-resolver'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const reviews = await getPendingReviews(limit)
    
    return NextResponse.json({
      success: true,
      data: reviews,
      count: reviews.length
    })
  } catch (error) {
    console.error('Error fetching pending reviews:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending reviews' },
      { status: 500 }
    )
  }
}
