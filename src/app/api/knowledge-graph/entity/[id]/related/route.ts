import { NextResponse } from 'next/server'
import { getEntityGraph } from '@/lib/phase2/relationship-manager'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const maxHops = parseInt(searchParams.get('maxHops') || '2')
    
    const graphData = await getEntityGraph(id, maxHops)
    
    return NextResponse.json({
      success: true,
      ...graphData
    })
  } catch (error) {
    console.error('Error fetching entity graph:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entity graph' },
      { status: 500 }
    )
  }
}
