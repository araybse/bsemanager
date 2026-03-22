import { NextResponse } from 'next/server'
import crypto from 'crypto'

function isValidSignature(payload: string, signature: string | null) {
  const verifier = process.env.QB_WEBHOOK_VERIFIER
  if (!verifier || !signature) return false
  const hmac = crypto.createHmac('sha256', verifier).update(payload).digest('base64')
  return hmac === signature
}

function shouldSyncExpenses(body: unknown) {
  const notifications = (body as { eventNotifications?: Array<Record<string, unknown>> })
    ?.eventNotifications
  if (!Array.isArray(notifications)) return false

  for (const notification of notifications) {
    const entities = (notification as { dataChangeEvent?: { entities?: Array<Record<string, unknown>> } })
      ?.dataChangeEvent?.entities
    if (!Array.isArray(entities)) continue
    for (const entity of entities) {
      const name = (entity.entityName || entity.name || '').toString()
      if (name === 'Purchase' || name === 'Bill') return true
    }
  }
  return false
}

function getBaseUrl(request: Request) {
  const publicUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (publicUrl) return publicUrl.replace(/\/$/, '')
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, '')}`
  return new URL(request.url).origin
}

export async function POST(request: Request) {
  const signature = request.headers.get('intuit-signature')
  const rawBody = await request.text()

  if (!isValidSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!shouldSyncExpenses(payload)) {
    return NextResponse.json({ ok: true })
  }

  const baseUrl = getBaseUrl(request)
  const internalSyncToken = process.env.INTERNAL_SYNC_TOKEN
  await fetch(`${baseUrl}/api/qb-time/sync?type=contract_labor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(internalSyncToken ? { 'x-internal-sync-token': internalSyncToken } : {}),
    },
  })

  await fetch(`${baseUrl}/api/qb-time/sync?type=expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(internalSyncToken ? { 'x-internal-sync-token': internalSyncToken } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}
