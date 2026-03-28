import { createAdminClient } from '@/lib/supabase/admin'
import { qboQuery } from '../qbo-client'
import type { QBSettings } from '../types'

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function normalizeProjectNumber(customerName: string): string {
  const value = (customerName || '').trim()
  const match = value.match(/(\d{2}-\d{2})/)
  if (match) return match[1]
  return value.split(' ')[0] || value
}

const INTERNAL_NON_PROJECT_CODES = new Set([
  'general',
  'business',
  'proposals',
  'go',
  'paid',
  'sonoc',
  'holiday',
  'training',
  'westland',
  'evrdev',
  'kcs',
  'san',
])

function isInternalNonProjectCode(projectNumber: string | null | undefined): boolean {
  return INTERNAL_NON_PROJECT_CODES.has(normalizeText(projectNumber))
}

function toDateString(value: Date): string {
  return value.toISOString().split('T')[0]
}

function monthStart(value: string | null | undefined): string | null {
  const text = String(value || '').trim()
  if (!text || text.length < 7) return null
  return `${text.slice(0, 7)}-01`
}

function getCalendarYearWindows(startDate: Date, endDate: Date): Array<{ year: number; start: string; end: string }> {
  const windows: Array<{ year: number; start: string; end: string }> = []
  let yearCursor = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  while (yearCursor <= endYear) {
    const yearStart = new Date(yearCursor, 0, 1)
    const yearEnd = new Date(yearCursor, 11, 31)
    const effectiveStart = yearCursor === startDate.getFullYear() ? startDate : yearStart
    const effectiveEnd = yearCursor === endDate.getFullYear() ? endDate : yearEnd
    windows.push({
      year: yearCursor,
      start: toDateString(effectiveStart),
      end: toDateString(effectiveEnd),
    })
    yearCursor += 1
  }

  return windows
}

function withinDateWindow(
  entryDate: string,
  effectiveFrom: string | null | undefined,
  effectiveTo: string | null | undefined
): boolean {
  if (effectiveFrom && entryDate < effectiveFrom) return false
  if (effectiveTo && entryDate > effectiveTo) return false
  return true
}

async function fetchAllQbLinkedTimeEntries<T>(
  supabase: ReturnType<typeof createAdminClient>,
  selectColumns: string,
  startDate: string,
  endDate: string,
  orderBy?: { column: string; ascending?: boolean }
): Promise<{ rows: T[]; error: unknown }> {
  const pageSize = 1000
  let from = 0
  const rows: T[] = []

  while (true) {
    let query = supabase
      .from('time_entries')
      .select(selectColumns)
      .gte('entry_date' as never, startDate as never)
      .lte('entry_date' as never, endDate as never)
      .not('qb_time_id' as never, 'is', null)
      .range(from, from + pageSize - 1)

    if (orderBy) {
      query = query.order(orderBy.column as never, { ascending: orderBy.ascending ?? true })
    }

    const { data, error } = await query
    if (error) return { rows, error }

    const batch = ((data as T[] | null) || []) as T[]
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return { rows, error: null }
}

type QbTimeActivity = {
  Id?: string | number
  TxnDate?: string
  Hours?: number | string
  Minutes?: number | string
  CostRate?: number
  HourlyRate?: number
  Description?: string
  BillableStatus?: string
  EmployeeRef?: { name?: string }
  VendorRef?: { name?: string }
  CustomerRef?: { name?: string }
  ItemRef?: { name?: string }
}

export async function syncTimeEntries(
  supabase: ReturnType<typeof createAdminClient>,
  settings: QBSettings,
  syncYear?: number,
  syncMonth?: number
) {
  const now = new Date()
  const requestedYear = Number.isInteger(syncYear) ? Number(syncYear) : now.getFullYear()
  const requestedMonth =
    Number.isInteger(syncMonth) && Number(syncMonth) >= 1 && Number(syncMonth) <= 12
      ? Number(syncMonth)
      : null

  const startDate = requestedMonth
    ? new Date(requestedYear, requestedMonth - 1, 1)
    : new Date(requestedYear, 0, 1)
  const monthEnd = requestedMonth
    ? new Date(requestedYear, requestedMonth, 0)
    : new Date(requestedYear, 11, 31)
  const endDate =
    requestedYear === now.getFullYear() && requestedMonth === now.getMonth() + 1
      ? now
      : requestedYear === now.getFullYear() && requestedMonth === null
        ? now
        : monthEnd

  const startDateStr = toDateString(startDate)
  const endDateStr = toDateString(endDate)
  const yearWindows = requestedMonth
    ? [{ year: requestedYear, start: startDateStr, end: endDateStr }]
    : getCalendarYearWindows(startDate, endDate)

  const fetchedQbIds = new Set<string>()
  const qboHoursByProject = new Map<string, number>()
  const qboHoursByEmployee = new Map<string, number>()
  const yearlySummaries: Array<{ year: number; fetched: number; deleted: number }> = []

  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, full_name, title, rate_position_id')

  const profileByName = new Map<
    string,
    { id: string; full_name: string; title: string | null; rate_position_id: number | null }
  >()
  ;(
    (profilesData as
      | Array<{ id: string; full_name: string; title: string | null; rate_position_id: number | null }>
      | null) || []
  ).forEach((profile) => {
    profileByName.set(normalizeText(profile.full_name), profile)
  })

  const { data: positionsData } = await supabase.from('rate_positions').select('id, name, code')
  const positionNameById = new Map<number, string>()
  const positionIdByName = new Map<string, number>()
  ;((positionsData as Array<{ id: number; name: string; code: string }> | null) || []).forEach((position) => {
    positionNameById.set(position.id, position.name)
    positionIdByName.set(normalizeText(position.name), position.id)
    positionIdByName.set(normalizeText(position.code), position.id)
  })

  const { data: historyData } = await supabase
    .from('employee_title_history')
    .select('employee_id, title, rate_position_id, effective_from, effective_to')

  const historyByEmployeeId = new Map<
    string,
    Array<{
      employee_id: string
      title: string
      rate_position_id: number | null
      effective_from: string
      effective_to: string | null
    }>
  >()
  ;(
    (historyData as
      | Array<{
          employee_id: string
          title: string
          rate_position_id: number | null
          effective_from: string
          effective_to: string | null
        }>
      | null) || []
  ).forEach((row) => {
    const current = historyByEmployeeId.get(row.employee_id) || []
    current.push(row)
    historyByEmployeeId.set(row.employee_id, current)
  })

  const { data: projectScheduleAssignmentsData } = await supabase
    .from('project_rate_schedule_assignments')
    .select('project_id, schedule_id')
  const scheduleByProjectId = new Map<number, number>()
  ;(
    (projectScheduleAssignmentsData as Array<{ project_id: number; schedule_id: number }> | null) || []
  ).forEach((row) => {
    scheduleByProjectId.set(row.project_id, row.schedule_id)
  })

  const { data: schedulesData } = await supabase.from('rate_schedules').select('id, year_label')
  const scheduleIdByYear = new Map<number, number>()
  ;((schedulesData as Array<{ id: number; year_label: number }> | null) || []).forEach((row) => {
    scheduleIdByYear.set(row.year_label, row.id)
  })

  const { data: projectsWithProposalData } = await supabase
    .from('projects')
    .select('id, proposal_id, proposals(date_submitted)')
  const proposalDefaultScheduleByProjectId = new Map<number, number>()
  ;(
    (projectsWithProposalData as
      | Array<{ id: number; proposal_id: number | null; proposals: { date_submitted: string | null } | null }>
      | null) || []
  ).forEach((row) => {
    const submittedDate = row.proposals?.date_submitted
    if (!submittedDate) return
    const year = Number(submittedDate.slice(0, 4))
    const scheduleId = scheduleIdByYear.get(year)
    if (scheduleId) proposalDefaultScheduleByProjectId.set(row.id, scheduleId)
  })

  const { data: scheduleItemsData } = await supabase
    .from('rate_schedule_items')
    .select('id, schedule_id, position_id, hourly_rate')
  const scheduleRateByScheduleAndPosition = new Map<string, { itemId: number; hourlyRate: number }>()
  ;(
    (scheduleItemsData as Array<{ id: number; schedule_id: number; position_id: number; hourly_rate: number }> | null) ||
    []
  ).forEach((row) => {
    scheduleRateByScheduleAndPosition.set(`${row.schedule_id}::${row.position_id}`, {
      itemId: row.id,
      hourlyRate: Number(row.hourly_rate) || 0,
    })
  })

  const { data: projectOverridesData } = await supabase
    .from('project_rate_position_overrides')
    .select('id, project_id, position_id, hourly_rate, effective_from, effective_to')
  const overridesByProjectAndPosition = new Map<
    string,
    Array<{
      id: number
      project_id: number
      position_id: number
      hourly_rate: number
      effective_from: string | null
      effective_to: string | null
    }>
  >()
  ;(
    (projectOverridesData as
      | Array<{
          id: number
          project_id: number
          position_id: number
          hourly_rate: number
          effective_from: string | null
          effective_to: string | null
        }>
      | null) || []
  ).forEach((row) => {
    const key = `${row.project_id}::${row.position_id}`
    const current = overridesByProjectAndPosition.get(key) || []
    current.push(row)
    overridesByProjectAndPosition.set(key, current)
  })

  let imported = 0
  let updated = 0
  let deleted = 0
  let deduped = 0
  const skipped = 0
  let errors = 0
  let totalFetched = 0

  // De-duplicate local qb_time_id rows up front to keep maybeSingle lookups safe.
  const { rows: preRows, error: preRowsError } = await fetchAllQbLinkedTimeEntries<{
    id: number
    qb_time_id: string | null
  }>(supabase, 'id, qb_time_id', startDateStr, endDateStr, { column: 'id', ascending: false })

  if (preRowsError) {
    console.error('Failed loading local rows for dedupe:', preRowsError)
    errors++
  } else {
    const seen = new Set<string>()
    const duplicateIds: number[] = []
    ;(preRows || []).forEach((row) => {
      const qbId = row.qb_time_id ? String(row.qb_time_id) : ''
      if (!qbId) return
      if (seen.has(qbId)) {
        duplicateIds.push(row.id)
      } else {
        seen.add(qbId)
      }
    })
    if (duplicateIds.length > 0) {
      const { error: dedupeDeleteError } = await supabase
        .from('time_entries')
        .delete()
        .in('id' as never, duplicateIds as never)
      if (dedupeDeleteError) {
        console.error('Failed deleting duplicate local qb_time_id rows:', dedupeDeleteError)
        errors++
      } else {
        deduped += duplicateIds.length
        deleted += duplicateIds.length
      }
    }
  }

  for (const window of yearWindows) {
    const timeActivities: Array<Record<string, unknown>> = []
    const windowFetchedQbIds = new Set<string>()
    const maxResults = 1000
    let startPosition = 1

    while (true) {
      const data = await qboQuery(
        settings,
        `SELECT * FROM TimeActivity WHERE TxnDate >= '${window.start}' AND TxnDate <= '${window.end}' STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
      )
      const batch = data.QueryResponse?.TimeActivity || []
      timeActivities.push(...batch)
      if (batch.length < maxResults) break
      startPosition += maxResults
    }

    totalFetched += timeActivities.length

    for (const activity of timeActivities) {
      try {
        const timeActivity = activity as QbTimeActivity
        const qbId = String(timeActivity.Id || '')
        if (!qbId) continue
        fetchedQbIds.add(qbId)
        windowFetchedQbIds.add(qbId)
        const { data: existing } = await supabase
          .from('time_entries')
          .select('id')
          .eq('qb_time_id' as never, qbId as never)
          .maybeSingle()

        const employeeName = timeActivity.EmployeeRef?.name || timeActivity.VendorRef?.name || 'Unknown'
        const customerName = timeActivity.CustomerRef?.name || ''
        const projectNumber = normalizeProjectNumber(customerName)
        const phaseName = timeActivity.ItemRef?.name || 'General'

        const hoursPart = Number(timeActivity.Hours ?? 0)
        const minutesPart = Number(timeActivity.Minutes ?? 0)
        const safeHoursPart = Number.isFinite(hoursPart) ? hoursPart : 0
        const safeMinutesPart = Number.isFinite(minutesPart) ? minutesPart : 0
        const hours = safeHoursPart + safeMinutesPart / 60
        const isBillable = timeActivity.BillableStatus === 'Billable'
        const projectKey = normalizeText(projectNumber)
        const employeeKey = normalizeText(employeeName)
        qboHoursByProject.set(projectKey, (qboHoursByProject.get(projectKey) || 0) + hours)
        qboHoursByEmployee.set(employeeKey, (qboHoursByEmployee.get(employeeKey) || 0) + hours)

        const costRate = timeActivity.CostRate || timeActivity.HourlyRate || 0
        const laborCost = hours * costRate

        const { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('project_number' as never, projectNumber as never)
          .maybeSingle()
        const projectRow = (project as { id: number } | null) || null
        const projectId = projectRow?.id || null

        const profileMatch = profileByName.get(normalizeText(employeeName))
        const employeeId = profileMatch?.id || null

        const payload = {
          qb_time_id: qbId,
          employee_id: employeeId,
          employee_name: employeeName,
          entry_date: timeActivity.TxnDate,
          billing_period: monthStart(timeActivity.TxnDate),
          project_number: projectNumber,
          project_id: projectId,
          phase_name: phaseName,
          hours,
          notes: timeActivity.Description || null,
          is_billable: isBillable,
          is_billed: false, // Will be calculated based on invoice billing_period, not QB status
          labor_cost: laborCost,
        } as never

        let timeEntryId: number | null = null
        if (existing) {
          const { error: updateError } = await supabase
            .from('time_entries')
            .update(payload)
            .eq('id' as never, (existing as { id: number }).id as never)
          if (updateError) {
            console.error('Failed to update time entry:', updateError)
            errors++
          } else {
            updated++
            timeEntryId = (existing as { id: number }).id
          }
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from('time_entries')
            .insert(payload)
            .select('id')
            .single()
          if (insertError) {
            console.error('Failed to insert time entry:', insertError)
            errors++
          } else {
            imported++
            timeEntryId = (inserted as { id: number }).id
          }
        }

        if (!timeEntryId) continue

        let resolvedPositionId: number | null = profileMatch?.rate_position_id || null
        let resolvedTitle: string | null = profileMatch?.title || null

        if (employeeId) {
          const employeeHistory = historyByEmployeeId.get(employeeId) || []
          const matchingHistory = employeeHistory
            .filter((row) => withinDateWindow(timeActivity.TxnDate || '', row.effective_from, row.effective_to))
            .sort((a, b) => (a.effective_from > b.effective_from ? -1 : 1))
          const latestHistory = matchingHistory[0]
          if (latestHistory) {
            resolvedPositionId = latestHistory.rate_position_id || resolvedPositionId
            resolvedTitle = latestHistory.title || resolvedTitle
          }
        }

        if (!resolvedPositionId && resolvedTitle) {
          const mappedPositionId = positionIdByName.get(normalizeText(resolvedTitle))
          if (mappedPositionId) resolvedPositionId = mappedPositionId
        }

        if (!resolvedPositionId) {
          const mappedPositionId = positionIdByName.get(normalizeText(employeeName))
          if (mappedPositionId) resolvedPositionId = mappedPositionId
        }

        const scheduleId =
          (projectId ? scheduleByProjectId.get(projectId) : undefined) ||
          (projectId ? proposalDefaultScheduleByProjectId.get(projectId) : undefined) ||
          null

        let resolvedHourlyRate: number | null = null
        let rateSource = 'fallback_default'
        let rateSourceId: number | null = null
        let effectiveFromUsed: string | null = null

        if (projectId && resolvedPositionId) {
          const overrideKey = `${projectId}::${resolvedPositionId}`
          const matchingOverride = (overridesByProjectAndPosition.get(overrideKey) || [])
            .filter((row) => withinDateWindow(timeActivity.TxnDate || '', row.effective_from, row.effective_to))
            .sort((a, b) => ((a.effective_from || '') > (b.effective_from || '') ? -1 : 1))[0]
          if (matchingOverride) {
            resolvedHourlyRate = Number(matchingOverride.hourly_rate) || 0
            rateSource = 'manual_override'
            rateSourceId = matchingOverride.id
            effectiveFromUsed = matchingOverride.effective_from || null
          }
        }

        if (resolvedHourlyRate === null && scheduleId && resolvedPositionId) {
          const scheduleRate = scheduleRateByScheduleAndPosition.get(`${scheduleId}::${resolvedPositionId}`)
          if (scheduleRate) {
            resolvedHourlyRate = scheduleRate.hourlyRate
            rateSource = 'schedule_of_rates'
            rateSourceId = scheduleRate.itemId
          }
        }

        if (resolvedHourlyRate === null) {
          resolvedHourlyRate = 0
          rateSource =
            !projectId && !isBillable && isInternalNonProjectCode(projectNumber)
              ? 'non_project_internal'
              : 'unresolved'
        }

        const resolvedTitleFinal =
          (resolvedPositionId ? positionNameById.get(resolvedPositionId) : null) ||
          resolvedTitle ||
          'Unmapped Position'

        const { error: snapshotError } = await supabase
          .from('time_entry_bill_rates')
          .upsert(
            {
              time_entry_id: timeEntryId,
              employee_id: employeeId,
              employee_name: employeeName,
              resolved_title: resolvedTitleFinal,
              resolved_hourly_rate: resolvedHourlyRate,
              rate_source: rateSource,
              rate_source_id: rateSourceId,
              effective_from_used: effectiveFromUsed,
              resolved_labor_hourly_rate: hours > 0 ? Number((laborCost / hours).toFixed(2)) : 0,
              labor_rate_source: costRate > 0 ? 'qbo_cost_rate' : 'qbo_derived_zero',
              labor_rate_source_id: null,
              labor_effective_from_used: timeActivity.TxnDate || null,
              resolved_at: new Date().toISOString(),
            } as never,
            { onConflict: 'time_entry_id' }
          )

        if (snapshotError) {
          console.error('Failed to upsert time entry bill rate snapshot:', snapshotError)
          errors++
        }
      } catch (err) {
        console.error('Error processing time activity:', err)
        errors++
      }
    }

    // Delete stale QB-linked entries for this calendar year window.
    const { rows: existingWindowRows, error: existingWindowError } = await fetchAllQbLinkedTimeEntries<{
      id: number
      qb_time_id: string | null
    }>(supabase, 'id, qb_time_id', window.start, window.end)

    let yearDeleted = 0
    if (existingWindowError) {
      console.error('Failed loading existing time entries for reconciliation:', existingWindowError)
      errors++
    } else {
      const typedRows = (existingWindowRows || []).filter((row) => row.qb_time_id)
      const staleIds = typedRows
        .filter((row) => !windowFetchedQbIds.has(String(row.qb_time_id)))
        .map((row) => row.id)

      if (staleIds.length) {
        const { error: deleteError } = await supabase
          .from('time_entries')
          .delete()
          .in('id' as never, staleIds as never)

        if (deleteError) {
          console.error('Failed deleting stale time entries:', deleteError)
          errors++
        } else {
          yearDeleted = staleIds.length
          deleted += staleIds.length
        }
      }
    }

    yearlySummaries.push({
      year: window.year,
      fetched: timeActivities.length,
      deleted: yearDeleted,
    })
  }

  // Compare reconciled local qb-linked rows to fetched QBO aggregates.
  const { rows: localWindowRows, error: localWindowError } = await fetchAllQbLinkedTimeEntries<{
    qb_time_id: string | null
    project_number: string
    employee_name: string
    hours: number
  }>(supabase, 'qb_time_id, project_number, employee_name, hours', startDateStr, endDateStr)

  const localHoursByProject = new Map<string, number>()
  const localHoursByEmployee = new Map<string, number>()
  let localEntryCount = 0

  if (localWindowError) {
    console.error('Failed loading local rows for comparison:', localWindowError)
    errors++
  } else {
    ;(localWindowRows || []).forEach((row) => {
      const qbId = row.qb_time_id ? String(row.qb_time_id) : ''
      if (!qbId || !fetchedQbIds.has(qbId)) return
      localEntryCount += 1
      const projectKey = normalizeText(row.project_number)
      const employeeKey = normalizeText(row.employee_name)
      localHoursByProject.set(projectKey, (localHoursByProject.get(projectKey) || 0) + Number(row.hours || 0))
      localHoursByEmployee.set(employeeKey, (localHoursByEmployee.get(employeeKey) || 0) + Number(row.hours || 0))
    })
  }

  const epsilon = 0.0001
  const projectKeys = new Set([...qboHoursByProject.keys(), ...localHoursByProject.keys()])
  const employeeKeys = new Set([...qboHoursByEmployee.keys(), ...localHoursByEmployee.keys()])

  let projectMismatchCount = 0
  projectKeys.forEach((key) => {
    const qboHours = qboHoursByProject.get(key) || 0
    const localHours = localHoursByProject.get(key) || 0
    if (Math.abs(qboHours - localHours) > epsilon) projectMismatchCount += 1
  })

  let employeeMismatchCount = 0
  employeeKeys.forEach((key) => {
    const qboHours = qboHoursByEmployee.get(key) || 0
    const localHours = localHoursByEmployee.get(key) || 0
    if (Math.abs(qboHours - localHours) > epsilon) employeeMismatchCount += 1
  })

  return {
    imported,
    updated,
    deleted,
    deduped,
    skipped,
    errors,
    total: totalFetched,
    windows: yearlySummaries,
    comparison: {
      window: { startDate: startDateStr, endDate: endDateStr },
      syncYear: requestedYear,
      syncMonth: requestedMonth,
      qboEntryCount: fetchedQbIds.size,
      localEntryCount,
      entryCountDelta: localEntryCount - fetchedQbIds.size,
      qboProjectGroups: qboHoursByProject.size,
      localProjectGroups: localHoursByProject.size,
      projectMismatchCount,
      qboEmployeeGroups: qboHoursByEmployee.size,
      localEmployeeGroups: localHoursByEmployee.size,
      employeeMismatchCount,
    },
  }
}
