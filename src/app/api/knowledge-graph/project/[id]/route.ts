import { NextResponse } from 'next/server'
import { getProjectKnowledge } from '@/lib/phase2/knowledge-graph-queries'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const knowledge = await getProjectKnowledge(params.id)
    
    if (!knowledge) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: knowledge
    })
  } catch (error) {
    console.error('Error fetching project knowledge:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch project knowledge' },
      { status: 500 }
    )
  }
}
