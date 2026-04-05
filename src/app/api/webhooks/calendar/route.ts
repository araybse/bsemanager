import { NextRequest, NextResponse } from 'next/server'

// MS365 Calendar Webhook Handler
// URL: https://bsemanager.vercel.app/api/webhooks/calendar

export async function GET(request: NextRequest) {
  // MS365 validation request
  const validationToken = request.nextUrl.searchParams.get('validationToken')
  
  if (validationToken) {
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
    
    // TODO: Store notification for processing
    // For now, just log it - we'll poll calendars instead
    
    // Return 202 Accepted immediately (MS365 expects fast response)
    return new NextResponse(null, { status: 202 })
    
  } catch (error) {
    console.error('Calendar webhook error:', error)
    // Still return 202 to avoid webhook validation failures
    return new NextResponse(null, { status: 202 })
  }
}
