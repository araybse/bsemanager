import { NextResponse } from 'next/server'
import { mergeEntities } from '@/lib/phase2/entity-resolver'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { entityId1, entityId2, mergedBy } = body
    
    if (!entityId1 || !entityId2) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: entityId1, entityId2' },
        { status: 400 }
      )
    }
    
    const result = await mergeEntities(entityId1, entityId2, mergedBy || 'system')
    
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error merging entities:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to merge entities' },
      { status: 500 }
    )
  }
}
