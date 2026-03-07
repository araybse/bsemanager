import { createAdminClient } from '@/lib/supabase/admin'
import { extractProjectStatus, fetchProjectStatusMap, qboQuery } from '../qbo-client'
import type { QBSettings } from '../types'

export async function syncProjects(
  supabase: ReturnType<typeof createAdminClient>,
  settings: QBSettings
) {
  const data = await qboQuery(settings, 'SELECT * FROM Customer MAXRESULTS 1000')
  const customers = data.QueryResponse?.Customer || []

  const clientMap = new Map<string, { id: number; name: string }>()
  for (const customer of customers) {
    if (!customer.ParentRef) {
      const { data: client } = await supabase
        .from('clients')
        .select('id, name')
        .eq('qb_customer_id' as never, customer.Id as never)
        .maybeSingle()
      if (client) clientMap.set(customer.Id, client as { id: number; name: string })
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

  for (const customer of customers) {
    try {
      if (!customer.ParentRef) {
        skipped++
        continue
      }

      const qbId = customer.Id
      const displayName = customer.DisplayName || customer.FullyQualifiedName || 'Unknown'
      const projectMatch = displayName.match(/(\d{2}-\d{2})/)
      const projectNumber = projectMatch ? projectMatch[1] : null
      const parentClient = clientMap.get(customer.ParentRef.value)

      let projectName = displayName
      if (displayName.includes(':')) projectName = displayName.split(':').pop()?.trim() || displayName
      if (projectNumber && projectName.startsWith(projectNumber)) {
        projectName = projectName.substring(projectNumber.length).trim()
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
        name: projectName || displayName,
        project_number: projectNumber || `QB-${qbId}`,
        client_id: parentClient?.id || null,
        qb_project_id: qbId,
        status,
      }

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
          await supabase.from('projects').insert(projectData as never)
          imported++
        }
      } else {
        await supabase.from('projects').insert(projectData as never)
        imported++
      }
    } catch (err) {
      console.error('Error syncing project:', err)
    }
  }

  return { imported, updated, skipped, total: customers.length }
}
