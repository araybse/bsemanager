import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshTokenIfNeeded } from '@/lib/qbo/sync/qbo-client'
import crypto from 'crypto'

/**
 * QuickBooks Webhook Receiver
 * 
 * Receives real-time notifications from QuickBooks Online when data changes.
 * Triggers immediate sync for the specific entity that changed.
 * 
 * Webhook Events:
 * - Invoice.Create, Invoice.Update, Invoice.Delete
 * - TimeActivity.Create, TimeActivity.Update, TimeActivity.Delete  
 * - Bill.Create, Bill.Update (for expenses)
 * - Payment.Create, Payment.Update
 * 
 * Security: Validates webhook signature using QB webhook token
 */

interface QBWebhookEvent {
  name: string // e.g., "Invoice.Create"
  id: string // Entity ID in QuickBooks
  operation: 'Create' | 'Update' | 'Delete'
  lastUpdated: string // ISO timestamp
  realmId: string // QB Company ID
}

interface QBWebhookPayload {
  eventNotifications: Array<{
    realmId: string
    dataChangeEvent: {
      entities: QBWebhookEvent[]
    }
  }>
}

/**
 * Verify webhook signature from QuickBooks
 * This ensures the request actually came from QuickBooks and wasn't spoofed
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  webhookToken: string
): boolean {
  if (!signature) return false
  
  const hmac = crypto.createHmac('sha256', webhookToken)
  hmac.update(payload)
  const expectedSignature = hmac.digest('base64')
  
  return signature === expectedSignature
}

/**
 * Queue a sync job for the specific entity that changed
 */
async function queueEntitySync(
  entityType: string,
  entityId: string,
  operation: string,
  realmId: string
) {
  const supabase = createAdminClient()
  
  // Map QB entity types to our sync domains
  const domainMap: Record<string, string> = {
    'Invoice': 'invoices',
    'TimeActivity': 'time_entries',
    'Bill': 'expenses',
    'Payment': 'payments',
    'Customer': 'customers',
    'Project': 'projects'
  }
  
  const domain = domainMap[entityType]
  if (!domain) {
    console.log(`Ignoring webhook for unsupported entity: ${entityType}`)
    return { skipped: true, reason: 'unsupported_entity' }
  }
  
  // Log the webhook event
  await supabase.from('sync_runs').insert({
    domain,
    trigger_mode: 'webhook',
    status: 'queued',
    started_at: new Date().toISOString(),
    metadata: {
      entity_type: entityType,
      entity_id: entityId,
      operation,
      realm_id: realmId
    }
  } as never)
  
  // Trigger sync via internal API call
  // We use the internal sync token to bypass auth checks
  const syncUrl = new URL(`/api/qb-time/sync/${domain}/${entityId}`, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  
  try {
    const response = await fetch(syncUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-sync-token': process.env.INTERNAL_SYNC_TOKEN || ''
      },
      body: JSON.stringify({ operation })
    })
    
    if (!response.ok) {
      console.error(`Sync failed for ${entityType} ${entityId}:`, await response.text())
      return { success: false, error: 'sync_failed' }
    }
    
    return { success: true }
  } catch (error) {
    console.error(`Error triggering sync for ${entityType} ${entityId}:`, error)
    return { success: false, error: String(error) }
  }
}

export async function POST(request: NextRequest) {
  try {
    const webhookToken = process.env.QB_WEBHOOK_TOKEN
    
    if (!webhookToken) {
      console.error('QB_WEBHOOK_TOKEN not configured')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }
    
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('intuit-signature')
    
    // Verify the webhook came from QuickBooks
    if (!verifyWebhookSignature(rawBody, signature, webhookToken)) {
      console.error('Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }
    
    // Parse the webhook payload
    const payload: QBWebhookPayload = JSON.parse(rawBody)
    
    // Process each notification
    const results = []
    
    for (const notification of payload.eventNotifications) {
      const { realmId, dataChangeEvent } = notification
      
      // Verify this is for our connected QB company
      const supabase = createAdminClient()
      const settings = await refreshTokenIfNeeded(supabase)
      
      if (settings.realm_id !== realmId) {
        console.log(`Webhook for different realm: ${realmId}, expected: ${settings.realm_id}`)
        continue
      }
      
      // Process each entity change
      for (const entity of dataChangeEvent.entities) {
        const [entityType] = entity.name.split('.') // "Invoice.Create" -> "Invoice"
        
        const result = await queueEntitySync(
          entityType,
          entity.id,
          entity.operation,
          realmId
        )
        
        results.push({
          entity: entity.name,
          id: entity.id,
          ...result
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    })
    
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for webhook verification
 * QuickBooks requires responding to verification challenges
 */
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge')
  
  if (challenge) {
    // QB sends a challenge during webhook setup - we just echo it back
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  return NextResponse.json({
    status: 'webhook_ready',
    message: 'QuickBooks webhook endpoint is active'
  })
}
