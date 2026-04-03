import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// MS365 Calendar Webhook Handler
// URL: https://bsemanager.vercel.app/api/webhooks/calendar

export async function GET(request: NextRequest) {
  // MS365 validation request
  const validationToken = request.nextUrl.searchParams.get('validationToken')
  
  if (validationToken) {
    console.log('✅ Calendar webhook validation')
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  return NextResponse.json({ status: 'ok', type: 'calendar-webhook' })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const notifications = body.value || []
    
    console.log(`📅 Calendar webhook: ${notifications.length} notification(s)`)
    
    for (const notification of notifications) {
      const changeType = notification.changeType // created, updated, deleted
      const eventId = notification.resourceData?.id
      
      console.log(`   ${changeType}: ${eventId?.substring(0, 30)}...`)
      
      // Store notification for Max to process
      const supabase = createAdminClient()
      await supabase.from('calendar_notifications' as never).insert({
        change_type: changeType,
        event_id: eventId,
        notification_data: notification,
        processed: false,
        received_at: new Date().toISOString()
      } as never)
    }
    
    // Return 202 Accepted immediately (MS365 expects fast response)
    return new NextResponse(null, { status: 202 })
    
  } catch (error) {
    console.error('Calendar webhook error:', error)
    return new NextResponse(null, { status: 500 })
  }
}
