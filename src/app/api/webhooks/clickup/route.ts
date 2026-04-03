import { NextRequest, NextResponse } from 'next/server'

// ClickUp Webhook Handler
// URL: https://bsemanager.vercel.app/api/webhooks/clickup
// Receives real-time notifications when tasks are assigned to Austin

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Log full payload for debugging
    console.log('📋 ClickUp webhook received:', JSON.stringify(body, null, 2))
    
    // ClickUp sends different event types
    const eventType = body.event
    const taskId = body.task_id
    const historyItems = body.history_items || []
    
    console.log(`   Event: ${eventType}, Task: ${taskId}`)
    
    // Check if this is a task assignment to Austin (user ID: 96293060)
    const assignmentChange = historyItems.find((item: any) => 
      item.field === 'assignee' && 
      item.after?.id === '96293060'
    )
    
    if (assignmentChange || eventType === 'taskAssigneeUpdated') {
      console.log('   🎯 Task assigned to Austin!')
      
      // TODO: Notify Max via Telegram
      // TODO: Fetch task details and add to Austin's schedule
      // TODO: Check for conflicts and suggest rescheduling
      
      // For now, just log it
      // Future: Send Telegram notification with task details
    }
    
    // Log other important events
    if (eventType === 'taskCreated' || eventType === 'taskUpdated') {
      console.log(`   Task event: ${eventType}`)
    }
    
    // Return 200 OK with JSON body (ClickUp expects fast response)
    return NextResponse.json({ status: 'ok', received: true }, { status: 200 })
    
  } catch (error) {
    console.error('ClickUp webhook error:', error)
    // Still return 200 to avoid webhook retries
    return NextResponse.json({ status: 'error', message: 'Internal error' }, { status: 200 })
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    type: 'clickup-webhook',
    message: 'ClickUp webhook endpoint is active'
  })
}
