import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'

type QBSettings = {
  id: number
  access_token: string
  refresh_token: string
  realm_id: string
  token_expires_at: string
  connected_at: string
  updated_at: string
}

async function refreshTokenIfNeeded(supabase: ReturnType<typeof createAdminClient>): Promise<QBSettings> {
  const { data: settings } = await supabase
    .from('qb_settings')
    .select('*')
    .single()

  if (!settings) {
    throw new Error('QuickBooks not connected')
  }

  const typedSettings = settings as unknown as QBSettings
  const expiresAt = new Date(typedSettings.token_expires_at)
  const now = new Date()

  // Refresh if token expires in less than 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const clientId = process.env.QB_CLIENT_ID!
    const clientSecret = process.env.QB_CLIENT_SECRET!

    const refreshResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: typedSettings.refresh_token,
      }),
    })

    if (!refreshResponse.ok) {
      throw new Error('Failed to refresh token')
    }

    const tokens = await refreshResponse.json()
    const newExpiresAt = new Date()
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokens.expires_in)

    await supabase
      .from('qb_settings')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id' as never, typedSettings.id as never)

    return { ...typedSettings, access_token: tokens.access_token }
  }

  return typedSettings
}

async function qboQuery(settings: QBSettings, query: string) {
  const encodedQuery = encodeURIComponent(query)
  const minorVersion = '70'
  const url = `https://quickbooks.api.intuit.com/v3/company/${settings.realm_id}/query?query=${encodedQuery}&minorversion=${minorVersion}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${settings.access_token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`QBO API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

export async function GET() {
  try {
    const auth = await requireApiRoles(['admin', 'project_manager'])
    if (!auth.ok) return auth.response

    const supabase = createAdminClient()
    const settings = await refreshTokenIfNeeded(supabase)

    const data = await qboQuery(settings, 'SELECT * FROM Item MAXRESULTS 1000')
    const items = data.QueryResponse?.Item || []

    const services = items
      .filter((item: { Active?: boolean; Type?: string; Name?: string; Id?: string }) =>
        item.Active !== false && (item.Type || '').toLowerCase() === 'service'
      )
      .map((item: { Name?: string; Id?: string }) => ({
        id: item.Id || '',
        name: item.Name || '',
      }))
      .filter((item: { name: string }) => item.name)

    return NextResponse.json({ items: services })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch QBO services' },
      { status: 500 }
    )
  }
}
