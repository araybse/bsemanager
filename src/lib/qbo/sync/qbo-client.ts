import { createAdminClient } from '@/lib/supabase/admin'
import type { QBSettings } from './types'

export async function refreshTokenIfNeeded(
  supabase: ReturnType<typeof createAdminClient>
): Promise<QBSettings> {
  const { data: settings } = await supabase.from('qb_settings').select('*').single()

  if (!settings) {
    throw new Error('QuickBooks not connected')
  }

  const typedSettings = settings as unknown as QBSettings
  const expiresAt = new Date(typedSettings.token_expires_at)
  const now = new Date()

  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const clientId = process.env.QB_CLIENT_ID!
    const clientSecret = process.env.QB_CLIENT_SECRET!

    const refreshResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
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

export async function qboQuery(settings: QBSettings, query: string) {
  const encodedQuery = encodeURIComponent(query)
  const minorVersion = '70'
  const url = `https://quickbooks.api.intuit.com/v3/company/${settings.realm_id}/query?query=${encodedQuery}&minorversion=${minorVersion}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${settings.access_token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`QBO API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

export async function fetchInvoiceById(settings: QBSettings, invoiceId: string) {
  const minorVersion = '70'
  const url = `https://quickbooks.api.intuit.com/v3/company/${settings.realm_id}/invoice/${invoiceId}?minorversion=${minorVersion}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${settings.access_token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`QBO Invoice fetch error ${response.status}: ${errorText}`)
  }

  return response.json()
}

export function extractProjectStatus(entity: Record<string, unknown> | null | undefined) {
  if (!entity) return null

  const customField = Array.isArray((entity as { CustomField?: unknown[] }).CustomField)
    ? (entity as { CustomField?: Array<{ Name?: string; StringValue?: string; value?: string }> }).CustomField?.find(
        (field) => {
          const normalizedName = (field.Name || '')
            .toLowerCase()
            .replace(/[\s_]+/g, '')
            .trim()
          return normalizedName === 'projectstatus' || normalizedName === 'jobstatus'
        }
      )
    : null

  const statusValue =
    customField?.StringValue ||
    customField?.value ||
    (entity as { JobStatus?: unknown }).JobStatus ||
    (entity as { JobStatusName?: unknown }).JobStatusName ||
    (entity as { ProjectStatus?: unknown }).ProjectStatus ||
    (entity as { ProjectStatusName?: unknown }).ProjectStatusName ||
    (entity as { Status?: unknown }).Status

  return statusValue ? statusValue.toString().trim() : null
}

export async function fetchProjectStatusMap(settings: QBSettings) {
  const url = 'https://qb.api.intuit.com/graphql'
  const query = `
    query ProjectStatuses($limit: Int, $offset: Int) {
      projectManagementProjects(limit: $limit, offset: $offset) {
        edges {
          node {
            id
            name
            status
            customer {
              id
              displayName
            }
          }
        }
        pageInfo {
          totalCount
          hasNextPage
        }
      }
    }
  `

  const byName = new Map<string, string>()
  let offset = 0
  const limit = 200
  let hasNextPage = true

  while (hasNextPage) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { limit, offset } }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`QBO GraphQL error ${response.status}: ${errorText}`)
    }

    const payload = await response.json()
    const projects = payload?.data?.projectManagementProjects
    const edges = (projects?.edges as Array<{ node?: { name?: string; status?: string } }> | undefined) || []
    for (const edge of edges) {
      const name = edge.node?.name?.trim()
      const status = edge.node?.status?.trim()
      if (name && status) byName.set(name.toLowerCase(), status)
    }

    hasNextPage = Boolean(projects?.pageInfo?.hasNextPage)
    offset += limit
  }

  return byName
}

export function extractProjectNumberFromName(name: string | null | undefined) {
  if (!name) return null
  const match = name.match(/\b\d{2}-\d{2}\b/)
  if (match) return match[0]
  const trimmed = name.trim()
  const prefix = trimmed.slice(0, 5)
  return /^\d{2}-\d{2}$/.test(prefix) ? prefix : null
}

export async function fetchContractLaborAccountId(settings: QBSettings) {
  const data = await qboQuery(
    settings,
    "SELECT * FROM Account WHERE Name = 'Contract Labor' MAXRESULTS 1"
  )
  const account = data.QueryResponse?.Account?.[0]
  if (!account?.Id) throw new Error('QBO Account "Contract Labor" not found')
  return account.Id as string
}

export async function fetchTransactions(
  settings: QBSettings,
  entity: 'Purchase' | 'Bill',
  since?: string | null
) {
  const maxResults = 1000
  let startPosition = 1
  const results: Array<Record<string, unknown>> = []
  while (true) {
    const filter = since ? ` WHERE MetaData.LastUpdatedTime >= '${since}'` : ''
    const query = `SELECT * FROM ${entity}${filter} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    const data = await qboQuery(settings, query)
    const records = (data.QueryResponse?.[entity] as Array<Record<string, unknown>> | undefined) || []
    records.forEach((record) => {
      record._entityType = entity
    })
    results.push(...records)
    if (records.length < maxResults) break
    startPosition += maxResults
  }
  return results
}
