import { NextResponse } from 'next/server'
import { parseAndExecute } from '@/lib/phase2/knowledge-graph-queries'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { query } = body
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid query parameter' },
        { status: 400 }
      )
    }
    
    const result = await parseAndExecute(query)
    
    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Error executing knowledge graph query:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute query' },
      { status: 500 }
    )
  }
}
