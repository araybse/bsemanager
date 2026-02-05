import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type QBSettings = {
  id: number
  access_token: string
  refresh_token: string
  realm_id: string
  token_expires_at: string
  connected_at: string
  updated_at: string
}

type SyncType = 'all' | 'time' | 'customers' | 'projects' | 'invoices'

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

function extractProjectStatus(entity: Record<string, unknown> | null | undefined) {
  if (!entity) return null

  const customField = Array.isArray((entity as { CustomField?: unknown[] }).CustomField)
    ? (entity as { CustomField?: Array<{ Name?: string; StringValue?: string; value?: string }> })
        .CustomField?.find((field) => {
          const normalizedName = (field.Name || '')
            .toLowerCase()
            .replace(/[\s_]+/g, '')
            .trim()
          return normalizedName === 'projectstatus' || normalizedName === 'jobstatus'
        })
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

async function fetchProjectStatusMap(settings: QBSettings) {
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
        'Authorization': `Bearer ${settings.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { limit, offset },
      }),
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
      if (name && status) {
        byName.set(name.toLowerCase(), status)
      }
    }

    hasNextPage = Boolean(projects?.pageInfo?.hasNextPage)
    offset += limit
  }

  return byName
}

async function syncCustomers(
  supabase: ReturnType<typeof createAdminClient>,
  settings: QBSettings
) {
  console.log('Syncing customers...')
  
  const data = await qboQuery(settings, 'SELECT * FROM Customer MAXRESULTS 1000')
  const customers = data.QueryResponse?.Customer || []
  
  let imported = 0
  let updated = 0
  let skipped = 0
  
  for (const customer of customers) {
    try {
      // Skip sub-customers (projects) for now - they have a ParentRef
      if (customer.ParentRef) {
        skipped++
        continue
      }
      
      const qbId = customer.Id
      const clientData = {
        name: customer.DisplayName || customer.CompanyName || 'Unknown',
        address_line_1: customer.BillAddr?.Line1 || null,
        address_line_2: [
          customer.BillAddr?.City,
          customer.BillAddr?.CountrySubDivisionCode,
          customer.BillAddr?.PostalCode
        ].filter(Boolean).join(', ') || null,
        email: customer.PrimaryEmailAddr?.Address || null,
        qb_customer_id: qbId,
      }
      
      // Check if customer already exists by QBO ID
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('qb_customer_id' as never, qbId as never)
        .maybeSingle()
      
      if (existing) {
        // Update existing
        await supabase
          .from('clients')
          .update(clientData as never)
          .eq('id' as never, (existing as { id: number }).id as never)
        updated++
      } else {
        // Check by name match
        const { data: nameMatch } = await supabase
          .from('clients')
          .select('id')
          .eq('name' as never, clientData.name as never)
          .maybeSingle()
        
        if (nameMatch) {
          // Update existing with QBO ID
          await supabase
            .from('clients')
            .update({ ...clientData, qb_customer_id: qbId } as never)
            .eq('id' as never, (nameMatch as { id: number }).id as never)
          updated++
        } else {
          // Insert new
          await supabase.from('clients').insert(clientData as never)
          imported++
        }
      }
    } catch (err) {
      console.error('Error syncing customer:', err)
    }
  }
  
  return { imported, updated, skipped, total: customers.length }
}

async function syncProjects(
  supabase: ReturnType<typeof createAdminClient>,
  settings: QBSettings
) {
  console.log('Syncing projects...')
  
  // Get all customers (including sub-customers which are projects)
  const data = await qboQuery(settings, 'SELECT * FROM Customer MAXRESULTS 1000')
  const customers = data.QueryResponse?.Customer || []
  
  // Build a map of parent customers (clients) first
  const clientMap = new Map<string, { id: number; name: string }>()
  
  // First pass: get all parent customers and their local client IDs
  for (const customer of customers) {
    if (!customer.ParentRef) {
      // This is a parent customer (client)
      const { data: client } = await supabase
        .from('clients')
        .select('id, name')
        .eq('qb_customer_id' as never, customer.Id as never)
        .maybeSingle()
      
      if (client) {
        clientMap.set(customer.Id, client as { id: number; name: string })
      }
    }
  }
  
  let imported = 0
  let updated = 0
  let skipped = 0
  let projectStatusByName: Map<string, string> | null = null

  try {
    projectStatusByName = await fetchProjectStatusMap(settings)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('Project status GraphQL fetch failed:', message)
  }
  
  // Second pass: sync sub-customers as projects
  for (const customer of customers) {
    try {
      // Only process sub-customers (they have a ParentRef)
      if (!customer.ParentRef) {
        skipped++
        continue
      }
      
      const qbId = customer.Id
      const displayName = customer.DisplayName || customer.FullyQualifiedName || 'Unknown'
      
      // Try to extract project number from the name (e.g., "24-01 Project Name" or "Client:24-01 Project")
      const projectMatch = displayName.match(/(\d{2}-\d{2})/)
      const projectNumber = projectMatch ? projectMatch[1] : null
      
      // Get parent client
      const parentId = customer.ParentRef.value
      const parentClient = clientMap.get(parentId)
      
      // Clean the project name (remove the parent prefix if present)
      let projectName = displayName
      if (displayName.includes(':')) {
        projectName = displayName.split(':').pop()?.trim() || displayName
      }
      
      // Remove the project number from the beginning of the name if present
      // e.g., "26-01 Shores Liquor Nocatee" -> "Shores Liquor Nocatee"
      if (projectNumber && projectName.startsWith(projectNumber)) {
        projectName = projectName.substring(projectNumber.length).trim()
        // Remove any leading dash or separator
        projectName = projectName.replace(/^[-—–\s]+/, '').trim()
      }
      
      let rawProjectStatus = extractProjectStatus(customer)

      if (!rawProjectStatus && projectStatusByName) {
        const nameKey = (displayName || projectName || '').toLowerCase().trim()
        rawProjectStatus = projectStatusByName.get(nameKey) || null
      }

      const normalizedProjectStatus = rawProjectStatus
        ? rawProjectStatus.toLowerCase().replace(/[\s-]+/g, '_')
        : null
      const status =
        normalizedProjectStatus === 'completed' ||
        normalizedProjectStatus === 'complete' ||
        normalizedProjectStatus === 'closed' ||
        normalizedProjectStatus === 'done' ||
        normalizedProjectStatus === 'finished'
          ? 'completed'
          : normalizedProjectStatus === 'on_hold' ||
              normalizedProjectStatus === 'onhold' ||
              normalizedProjectStatus === 'hold' ||
              normalizedProjectStatus === 'paused'
            ? 'on_hold'
            : normalizedProjectStatus === 'cancelled' ||
                normalizedProjectStatus === 'canceled' ||
                normalizedProjectStatus === 'void'
              ? 'cancelled'
              : normalizedProjectStatus === 'active' ||
                  normalizedProjectStatus === 'in_progress' ||
                  normalizedProjectStatus === 'inprogress' ||
                  normalizedProjectStatus === 'open'
                ? 'active'
                : customer.Active !== false
                  ? 'active'
                  : 'completed'

      const projectData = {
        name: projectName || displayName, // Fallback to displayName if name becomes empty
        project_number: projectNumber || `QB-${qbId}`,
        client_id: parentClient?.id || null,
        qb_project_id: qbId,
        status,
      }
      
      // Check if project exists by QBO ID
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('qb_project_id' as never, qbId as never)
        .maybeSingle()
      
      if (existing) {
        await supabase
          .from('projects')
          .update(projectData as never)
          .eq('id' as never, (existing as { id: number }).id as never)
        updated++
      } else if (projectNumber) {
        // Try to match by project number
        const { data: numberMatch } = await supabase
          .from('projects')
          .select('id')
          .eq('project_number' as never, projectNumber as never)
          .maybeSingle()
        
        if (numberMatch) {
          await supabase
            .from('projects')
            .update({ ...projectData, qb_project_id: qbId } as never)
            .eq('id' as never, (numberMatch as { id: number }).id as never)
          updated++
        } else {
          // Insert new project
          await supabase.from('projects').insert(projectData as never)
          imported++
        }
      } else {
        // No project number found, insert with generated number
        await supabase.from('projects').insert(projectData as never)
        imported++
      }
    } catch (err) {
      console.error('Error syncing project:', err)
    }
  }
  
  return { imported, updated, skipped, total: customers.length }
}

async function syncInvoices(
  supabase: ReturnType<typeof createAdminClient>,
  settings: QBSettings
) {
  console.log('Syncing invoices...')
  
  // Get invoices from the last 2 years
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
  const startDate = twoYearsAgo.toISOString().split('T')[0]
  
  const data = await qboQuery(
    settings, 
    `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' MAXRESULTS 1000`
  )
  const invoices = data.QueryResponse?.Invoice || []
  
  let imported = 0
  let updated = 0
  let skipped = 0
  
  for (const invoice of invoices) {
    try {
      const qbId = invoice.Id
      const docNumber = invoice.DocNumber || `QB-${qbId}`
      
      // Try to extract project number from CustomerRef name
      const customerName = invoice.CustomerRef?.name || ''
      const projectMatch = customerName.match(/^(\d{2}-\d{2})/)
      const projectNumber = projectMatch ? projectMatch[1] : null
      
      // Find project
      let projectId = null
      if (projectNumber) {
        const { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('project_number' as never, projectNumber as never)
          .maybeSingle()
        projectId = (project as { id: number } | null)?.id || null
      }
      
      // Map QBO status to our status
      let status = 'draft'
      if (invoice.Balance === 0 && invoice.TotalAmt > 0) {
        status = 'paid'
      } else if (invoice.EmailStatus === 'EmailSent' || invoice.DeliveryInfo?.DeliveryType === 'Email') {
        status = 'sent'
      } else if (invoice.TxnDate) {
        status = 'finalized'
      }
      
      const invoiceData = {
        invoice_number: docNumber,
        project_id: projectId,
        invoice_date: invoice.TxnDate,
        due_date: invoice.DueDate || null,
        amount: invoice.TotalAmt || 0,
        status,
        qb_invoice_id: qbId,
        notes: invoice.CustomerMemo?.value || null,
      }
      
      // Check if invoice exists by QBO ID
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('qb_invoice_id' as never, qbId as never)
        .maybeSingle()
      
      if (existing) {
        await supabase
          .from('invoices')
          .update(invoiceData as never)
          .eq('id' as never, (existing as { id: number }).id as never)
        updated++
      } else {
        // Check by invoice number
        const { data: numberMatch } = await supabase
          .from('invoices')
          .select('id')
          .eq('invoice_number' as never, docNumber as never)
          .maybeSingle()
        
        if (numberMatch) {
          await supabase
            .from('invoices')
            .update({ ...invoiceData, qb_invoice_id: qbId } as never)
            .eq('id' as never, (numberMatch as { id: number }).id as never)
          updated++
        } else {
          await supabase.from('invoices').insert(invoiceData as never)
          imported++
        }
      }
      
      // Sync invoice line items
      if (invoice.Line && Array.isArray(invoice.Line)) {
        const existingInvoice = existing || 
          (await supabase
            .from('invoices')
            .select('id')
            .eq('qb_invoice_id' as never, qbId as never)
            .single()).data
        
        if (existingInvoice) {
          const invoiceId = (existingInvoice as { id: number }).id
          
          for (const line of invoice.Line) {
            if (line.DetailType === 'SalesItemLineDetail' && line.Amount) {
              // Try to match phase from item description
              const itemName = line.SalesItemLineDetail?.ItemRef?.name || line.Description || ''
              
              // Find phase by name
              let phaseId = null
              if (projectId && itemName) {
                const { data: phase } = await supabase
                  .from('contract_phases')
                  .select('id')
                  .eq('project_id' as never, projectId as never)
                  .ilike('phase_name' as never, `%${itemName.substring(0, 20)}%` as never)
                  .maybeSingle()
                phaseId = (phase as { id: number } | null)?.id || null
              }
              
              // Check if line item exists
              const { data: existingLine } = await supabase
                .from('invoice_line_items')
                .select('id')
                .eq('invoice_id' as never, invoiceId as never)
                .eq('qb_line_id' as never, line.Id as never)
                .maybeSingle()
              
              const lineData = {
                invoice_id: invoiceId,
                phase_id: phaseId,
                description: line.Description || itemName,
                amount: line.Amount,
                qb_line_id: line.Id,
              }
              
              if (existingLine) {
                await supabase
                  .from('invoice_line_items')
                  .update(lineData as never)
                  .eq('id' as never, (existingLine as { id: number }).id as never)
              } else {
                await supabase.from('invoice_line_items').insert(lineData as never)
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error syncing invoice:', err)
    }
  }
  
  return { imported, updated, skipped, total: invoices.length }
}

async function syncTimeEntries(
  supabase: ReturnType<typeof createAdminClient>,
  settings: QBSettings
) {
  console.log('Syncing time entries...')
  
  // Get the latest entry date from the database
  const { data: latestEntry } = await supabase
    .from('time_entries')
    .select('entry_date')
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  const typedLatestEntry = latestEntry as { entry_date: string } | null
  
  const endDate = new Date()
  let startDate: Date
  
  if (typedLatestEntry && typedLatestEntry.entry_date) {
    startDate = new Date(typedLatestEntry.entry_date)
  } else {
    startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)
  }
  
  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]
  
  const data = await qboQuery(
    settings,
    `SELECT * FROM TimeActivity WHERE TxnDate >= '${startDateStr}' AND TxnDate <= '${endDateStr}'`
  )
  const timeActivities = data.QueryResponse?.TimeActivity || []
  
  let imported = 0
  let skipped = 0
  let errors = 0
  
  for (const activity of timeActivities) {
    try {
      const qbId = activity.Id
      const { data: existing } = await supabase
        .from('time_entries')
        .select('id')
        .eq('qb_time_id' as never, qbId as never)
        .maybeSingle()
      
      if (existing) {
        skipped++
        continue
      }
      
      const employeeName = activity.EmployeeRef?.name || activity.VendorRef?.name || 'Unknown'
      const customerName = activity.CustomerRef?.name || ''
      const projectMatch = customerName.match(/^(\d{2}-\d{2})/)
      const projectNumber = projectMatch ? projectMatch[1] : customerName.split(' ')[0]
      const phaseName = activity.ItemRef?.name || 'General'
      
      let hours = 0
      if (activity.Hours !== undefined) {
        hours = activity.Hours
      } else if (activity.Minutes !== undefined) {
        hours = activity.Minutes / 60
      }
      
      const costRate = activity.CostRate || activity.HourlyRate || 0
      const laborCost = hours * costRate
      
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('project_number' as never, projectNumber as never)
        .maybeSingle()
      
      const { error: insertError } = await supabase.from('time_entries').insert({
        qb_time_id: qbId,
        employee_name: employeeName,
        entry_date: activity.TxnDate,
        project_number: projectNumber,
        project_id: (project as { id: number } | null)?.id || null,
        phase_name: phaseName,
        hours: hours,
        notes: activity.Description || null,
        is_billable: activity.BillableStatus === 'Billable',
        is_billed: activity.BillableStatus === 'HasBeenBilled',
        labor_cost: laborCost,
      } as never)
      
      if (insertError) {
        console.error('Failed to insert time entry:', insertError)
        errors++
      } else {
        imported++
      }
    } catch (err) {
      console.error('Error processing time activity:', err)
      errors++
    }
  }
  
  return { imported, skipped, errors, total: timeActivities.length }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const settings = await refreshTokenIfNeeded(supabase)
    
    if (!settings.realm_id) {
      return NextResponse.json(
        { error: 'No QuickBooks company connected. Please reconnect.' },
        { status: 400 }
      )
    }
    
    // Get sync type from request body
    let syncType: SyncType = 'all'
    try {
      const body = await request.json()
      syncType = body.type || 'all'
    } catch {
      // Default to 'all' if no body
    }
    
    const results: Record<string, unknown> = {}
    
    if (syncType === 'all' || syncType === 'customers') {
      results.customers = await syncCustomers(supabase, settings)
    }
    
    if (syncType === 'all' || syncType === 'projects') {
      results.projects = await syncProjects(supabase, settings)
    }
    
    if (syncType === 'all' || syncType === 'invoices') {
      results.invoices = await syncInvoices(supabase, settings)
    }
    
    if (syncType === 'all' || syncType === 'time') {
      results.timeEntries = await syncTimeEntries(supabase, settings)
    }
    
    return NextResponse.json({
      success: true,
      results,
      message: 'Sync completed successfully',
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
