import { NextRequest, NextResponse } from 'next/server'

// ClickUp Webhook Handler
// URL: https://bsemanager.vercel.app/api/webhooks/clickup
// Receives real-time notifications when tasks are assigned to Austin

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // ClickUp sends different event types
    const eventType = body.event
    const taskId = body.task_id
    const historyItems = body.history_items || []
    
    console.log(`📋 ClickUp webhook: ${eventType} for task ${taskId}`)
    
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
    
    // Return 200 OK (ClickUp expects fast response)
    return new NextResponse(null, { status: 200 })
    
  } catch (error) {
    console.error('ClickUp webhook error:', error)
    // Still return 200 to avoid webhook retries
    return new NextResponse(null, { status: 200 })
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
