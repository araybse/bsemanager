import { NextResponse } from 'next/server'
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

export async function POST() {
  try {
    const supabase = createAdminClient()
    
    // Get and refresh tokens if needed
    const settings = await refreshTokenIfNeeded(supabase)
    
    if (!settings.realm_id) {
      return NextResponse.json(
        { error: 'No QuickBooks company connected. Please reconnect.' },
        { status: 400 }
      )
    }
    
    // Get the latest entry date from the database
    const { data: latestEntry } = await supabase
      .from('time_entries')
      .select('entry_date')
      .order('entry_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    const typedLatestEntry = latestEntry as { entry_date: string } | null
    
    // Start from the latest entry date, or 90 days ago if no entries exist
    const endDate = new Date()
    let startDate: Date
    
    if (typedLatestEntry && typedLatestEntry.entry_date) {
      // Start from the day of the latest entry (to catch any same-day additions)
      startDate = new Date(typedLatestEntry.entry_date)
    } else {
      // No existing entries, go back 90 days
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 90)
    }
    
    // Format dates for QBO query
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    
    console.log(`Syncing time entries from ${startDateStr} to ${endDateStr}`)
    
    // Query TimeActivity from QuickBooks Online
    // Using the QBO API v3
    const query = encodeURIComponent(
      `SELECT * FROM TimeActivity WHERE TxnDate >= '${startDateStr}' AND TxnDate <= '${endDateStr}'`
    )
    
    const qboUrl = `https://quickbooks.api.intuit.com/v3/company/${settings.realm_id}/query?query=${query}`
    
    console.log('Fetching from QBO:', qboUrl)
    
    const response = await fetch(qboUrl, {
      headers: {
        'Authorization': `Bearer ${settings.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('QBO API error:', response.status, errorText)
      
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'QuickBooks authorization expired. Please reconnect.' },
          { status: 401 }
        )
      }
      
      if (response.status === 403) {
        // Parse error details
        let errorDetails = 'Access denied'
        try {
          const errorJson = JSON.parse(errorText)
          errorDetails = errorJson.Fault?.Error?.[0]?.Detail || 
                        errorJson.Fault?.Error?.[0]?.Message ||
                        errorText
        } catch {
          errorDetails = errorText
        }
        
        return NextResponse.json(
          { error: `QuickBooks access denied: ${errorDetails}. You may need to disconnect and reconnect with updated permissions.` },
          { status: 403 }
        )
      }
      
      return NextResponse.json(
        { error: `QuickBooks API error: ${response.status} - ${errorText}` },
        { status: 500 }
      )
    }
    
    const data = await response.json()
    const timeActivities = data.QueryResponse?.TimeActivity || []
    
    console.log(`Found ${timeActivities.length} time activities`)
    
    let imported = 0
    let skipped = 0
    let errors = 0
    
    // Process each time activity
    for (const activity of timeActivities) {
      try {
        // Skip if already imported (use QBO Id as unique identifier)
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
        
        // Extract employee name
        const employeeName = activity.EmployeeRef?.name || 
                            activity.VendorRef?.name || 
                            'Unknown'
        
        // Extract project info from Customer (job) reference
        // In QBO, jobs/projects are typically stored as Customer:Job
        const customerName = activity.CustomerRef?.name || ''
        // Try to extract project number (assumes format like "24-01 Project Name" or just "24-01")
        const projectMatch = customerName.match(/^(\d{2}-\d{2})/)
        const projectNumber = projectMatch ? projectMatch[1] : customerName.split(' ')[0]
        
        // Extract service/phase from ItemRef
        const phaseName = activity.ItemRef?.name || 'General'
        
        // Calculate hours (QBO stores time in minutes or as Hours/Minutes)
        let hours = 0
        if (activity.Hours !== undefined) {
          hours = activity.Hours
        } else if (activity.Minutes !== undefined) {
          hours = activity.Minutes / 60
        }
        
        // Calculate labor cost if available
        // QBO may provide CostRate or we can calculate from hourly rate
        const costRate = activity.CostRate || activity.HourlyRate || 0
        const laborCost = hours * costRate
        
        // Build time entry
        const timeEntry = {
          qb_time_id: qbId,
          employee_name: employeeName,
          entry_date: activity.TxnDate,
          project_number: projectNumber,
          phase_name: phaseName,
          hours: hours,
          notes: activity.Description || null,
          is_billable: activity.BillableStatus === 'Billable',
          is_billed: activity.BillableStatus === 'HasBeenBilled',
          labor_cost: laborCost,
        }
        
        // Try to match project
        const { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('project_number' as never, projectNumber as never)
          .maybeSingle()
        
        // Insert time entry
        const { error: insertError } = await supabase.from('time_entries').insert({
          ...timeEntry,
          project_id: (project as { id: number } | null)?.id || null,
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
    
    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      total: timeActivities.length,
      message: `Imported ${imported} entries, skipped ${skipped} duplicates${errors > 0 ? `, ${errors} errors` : ''}`,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
