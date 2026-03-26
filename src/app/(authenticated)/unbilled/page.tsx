'use client'
import { usePermissionRedirect } from '@/lib/auth/use-permission-redirect'

import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endOfMonth, format, subMonths } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatHours } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Tables } from '@/lib/types/database'

interface TimeEntryWithRate {
  id: number
  employee_id: string | null
  employee_name: string
  entry_date: string
  project_number: string
  project_id: number | null
  phase_name: string
  hours: number
  notes: string | null
  hourly_rate: number
  amount: number
  project_name: string
  is_rate_unresolved: boolean
  rate_source: string
}

type TimeEntryWithProject = Tables<'time_entries'> & {
  projects: { name: string } | null
}

export default function UnbilledReportPage() {
  const supabase = createClient()
  const [selectedMonth, setSelectedMonth] = useState(() => format(subMonths(new Date(), 1), 'yyyy-MM'))
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({})
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({})

  const monthOptions = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 24 }, (_, index) => {
      const monthDate = subMonths(today, index)
      return {
        value: format(monthDate, 'yyyy-MM'),
        label: format(monthDate, 'MMMM yyyy'),
      }
    })
  }, [])

  const selectedMonthLabel =
    monthOptions.find((option) => option.value === selectedMonth)?.label || selectedMonth

  const { monthStart, monthEnd } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const start = new Date(year, month - 1, 1)
    const end = endOfMonth(start)
    return {
      monthStart: format(start, 'yyyy-MM-dd'),
      monthEnd: format(end, 'yyyy-MM-dd'),
    }
  }, [selectedMonth])

  const { data: unbilledData, isLoading, error } = useQuery({
    queryKey: ['unbilled-report', selectedMonth],
    queryFn: async () => {
      // Get unbilled time entries with rates
      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select(`
          id,
          employee_name,
          entry_date,
          project_number,
          phase_name,
          hours,
          notes,
          project_id,
          projects (name)
        `)
        .gte('entry_date', monthStart)
        .lte('entry_date', monthEnd)
        .order('project_number')
        .order('phase_name')
        .order('employee_name')

      if (timeError) throw timeError

      const typedEntries = timeEntries as unknown as TimeEntryWithProject[]

      const entryIds = (typedEntries || []).map((entry) => entry.id)
      const projectIds = Array.from(new Set((typedEntries || []).map((entry) => entry.project_id).filter(Boolean)))
      const employeeIds = Array.from(
        new Set((typedEntries || []).map((entry) => entry.employee_id).filter((value): value is string => Boolean(value)))
      )

      const { data: snapRates } = entryIds.length
        ? await supabase
            .from('time_entry_bill_rates')
            .select('time_entry_id, resolved_hourly_rate')
            .in('time_entry_id' as never, entryIds as never)
        : { data: [] as Array<{ time_entry_id: number; resolved_hourly_rate: number }> }

      const { data: projectScheduleAssignments } = projectIds.length
        ? await supabase
            .from('project_rate_schedule_assignments')
            .select('project_id, schedule_id')
            .in('project_id' as never, projectIds as never)
        : { data: [] as Array<{ project_id: number; schedule_id: number }> }

      const { data: projectsForRates } = projectIds.length
        ? await supabase
            .from('projects')
            .select('id, proposal_id, proposals(date_submitted)')
            .in('id' as never, projectIds as never)
        : {
            data: [] as Array<{ id: number; proposal_id: number | null; proposals: { date_submitted: string | null } | null }>,
          }

      const { data: schedules } = await supabase.from('rate_schedules').select('id, year_label')
      const { data: scheduleItems } = await supabase
        .from('rate_schedule_items')
        .select('schedule_id, position_id, hourly_rate')

      const { data: projectOverrides } = projectIds.length
        ? await supabase
            .from('project_rate_position_overrides')
            .select('project_id, position_id, hourly_rate, effective_from, effective_to')
            .in('project_id' as never, projectIds as never)
        : {
            data: [] as Array<{
              project_id: number
              position_id: number
              hourly_rate: number
              effective_from: string | null
              effective_to: string | null
            }>,
          }

      const { data: profilePositions } = employeeIds.length
        ? await supabase
            .from('profiles')
            .select('id, rate_position_id')
            .in('id' as never, employeeIds as never)
        : { data: [] as Array<{ id: string; rate_position_id: number | null }> }

      const { data: timelineRows } = employeeIds.length
        ? await supabase
            .from('employee_title_history')
            .select('employee_id, rate_position_id, effective_from, effective_to')
            .in('employee_id' as never, employeeIds as never)
        : {
            data: [] as Array<{
              employee_id: string
              rate_position_id: number | null
              effective_from: string
              effective_to: string | null
            }>,
          }

      const snapRateByEntryId = new Map<number, number>()
      ;(
        (snapRates as Array<{ time_entry_id: number; resolved_hourly_rate: number }> | null) || []
      ).forEach((row) => {
        snapRateByEntryId.set(row.time_entry_id, Number(row.resolved_hourly_rate) || 0)
      })

      const scheduleIdByProjectId = new Map<number, number>()
      ;((projectScheduleAssignments as Array<{ project_id: number; schedule_id: number }> | null) || []).forEach(
        (row) => {
          scheduleIdByProjectId.set(row.project_id, row.schedule_id)
        }
      )

      const scheduleIdByYear = new Map<number, number>()
      ;((schedules as Array<{ id: number; year_label: number }> | null) || []).forEach((row) => {
        scheduleIdByYear.set(Number(row.year_label), row.id)
      })

      ;(
        (projectsForRates as
          | Array<{ id: number; proposal_id: number | null; proposals: { date_submitted: string | null } | null }>
          | null) || []
      ).forEach((project) => {
        if (scheduleIdByProjectId.has(project.id)) return
        const submittedDate = project.proposals?.date_submitted
        if (!submittedDate) return
        const year = Number(submittedDate.slice(0, 4))
        const scheduleId = scheduleIdByYear.get(year)
        if (scheduleId) scheduleIdByProjectId.set(project.id, scheduleId)
      })

      const scheduleRateByScheduleAndPosition = new Map<string, number>()
      ;((scheduleItems as Array<{ schedule_id: number; position_id: number; hourly_rate: number }> | null) || []).forEach((row) => {
        scheduleRateByScheduleAndPosition.set(
          `${row.schedule_id}::${row.position_id}`,
          Number(row.hourly_rate) || 0
        )
      })

      const overridesByProjectAndPosition = new Map<
        string,
        Array<{
          project_id: number
          position_id: number
          hourly_rate: number
          effective_from: string | null
          effective_to: string | null
        }>
      >()
      ;(
        (projectOverrides as
          | Array<{
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

      const profilePositionByEmployeeId = new Map<string, number | null>()
      ;((profilePositions as Array<{ id: string; rate_position_id: number | null }> | null) || []).forEach((row) => {
        profilePositionByEmployeeId.set(row.id, row.rate_position_id)
      })

      const timelineByEmployeeId = new Map<
        string,
        Array<{
          employee_id: string
          rate_position_id: number | null
          effective_from: string
          effective_to: string | null
        }>
      >()
      ;(
        (timelineRows as
          | Array<{
              employee_id: string
              rate_position_id: number | null
              effective_from: string
              effective_to: string | null
            }>
          | null) || []
      ).forEach((row) => {
        const current = timelineByEmployeeId.get(row.employee_id) || []
        current.push(row)
        timelineByEmployeeId.set(row.employee_id, current)
      })

      // Resolve rates in-memory for all entries
      const entriesWithRates: TimeEntryWithRate[] = []

      for (const entry of typedEntries || []) {
        const snapshotRate = snapRateByEntryId.get(entry.id)
        const employeeTimelineRows = entry.employee_id ? timelineByEmployeeId.get(entry.employee_id) || [] : []
        const timelineMatch = employeeTimelineRows
          .filter(
            (row) =>
              (!row.effective_from || row.effective_from <= entry.entry_date) &&
              (!row.effective_to || row.effective_to >= entry.entry_date)
          )
          .sort((a, b) => (a.effective_from > b.effective_from ? -1 : 1))[0]
        const positionId =
          timelineMatch?.rate_position_id ??
          (entry.employee_id ? profilePositionByEmployeeId.get(entry.employee_id) ?? null : null)

        const scheduleId = entry.project_id ? scheduleIdByProjectId.get(entry.project_id) || null : null
        let resolvedRate: number | null = null
        let rateSource = 'unresolved'

        if (entry.project_id && positionId) {
          const overrideKey = `${entry.project_id}::${positionId}`
          const override = (overridesByProjectAndPosition.get(overrideKey) || [])
            .filter(
              (row) =>
                (!row.effective_from || row.effective_from <= entry.entry_date) &&
                (!row.effective_to || row.effective_to >= entry.entry_date)
            )
            .sort((a, b) => ((a.effective_from || '') > (b.effective_from || '') ? -1 : 1))[0]
          if (override) {
            resolvedRate = Number(override.hourly_rate) || 0
            rateSource = 'manual_override_fallback'
          }
        }

        if (resolvedRate === null && scheduleId && positionId) {
          const scheduleRate = scheduleRateByScheduleAndPosition.get(`${scheduleId}::${positionId}`)
          if (typeof scheduleRate === 'number') {
            resolvedRate = scheduleRate
            rateSource = 'schedule_of_rates_fallback'
          }
        }

        const hourlyRate = snapshotRate ?? resolvedRate ?? 0
        if (snapshotRate !== undefined) rateSource = 'snapshot'

        entriesWithRates.push({
          id: entry.id,
          employee_id: entry.employee_id,
          employee_name: entry.employee_name,
          entry_date: entry.entry_date,
          project_number: entry.project_number,
          project_id: entry.project_id,
          phase_name: entry.phase_name,
          hours: entry.hours,
          notes: entry.notes,
          hourly_rate: hourlyRate,
          amount: entry.hours * hourlyRate,
          project_name: entry.projects?.name || '',
          is_rate_unresolved: snapshotRate === undefined && resolvedRate === null,
          rate_source: rateSource,
        })
      }

      const excludedProjectSections = new Set(['paid', 'holiday', 'general', 'business'])
      const reportEntries = entriesWithRates.filter((entry) => {
        const projectKey = (entry.project_number || '').trim().toLowerCase()
        return projectKey.length > 0 && !excludedProjectSections.has(projectKey)
      })

      // Group by project, then phase, then employee
      const grouped = reportEntries.reduce((acc, entry) => {
        const projectKey = entry.project_number
        if (!acc[projectKey]) {
          acc[projectKey] = {
            project_number: entry.project_number,
            project_name: entry.project_name,
            phases: {} as Record<string, {
              phase_name: string
              employees: Record<string, {
                employee_name: string
                entries: TimeEntryWithRate[]
                total: number
              }>
              total: number
            }>,
            total: 0,
          }
        }

        const phaseKey = entry.phase_name
        if (!acc[projectKey].phases[phaseKey]) {
          acc[projectKey].phases[phaseKey] = {
            phase_name: entry.phase_name,
            employees: {},
            total: 0,
          }
        }

        const empKey = entry.employee_name
        if (!acc[projectKey].phases[phaseKey].employees[empKey]) {
          acc[projectKey].phases[phaseKey].employees[empKey] = {
            employee_name: entry.employee_name,
            entries: [],
            total: 0,
          }
        }

        acc[projectKey].phases[phaseKey].employees[empKey].entries.push(entry)
        acc[projectKey].phases[phaseKey].employees[empKey].total += entry.amount
        acc[projectKey].phases[phaseKey].total += entry.amount
        acc[projectKey].total += entry.amount

        return acc
      }, {} as Record<string, {
        project_number: string
        project_name: string
        phases: Record<string, {
          phase_name: string
          employees: Record<string, {
            employee_name: string
            entries: TimeEntryWithRate[]
            total: number
          }>
          total: number
        }>
        total: number
      }>)

      const grandTotal = Object.values(grouped).reduce((sum, p) => sum + p.total, 0)

      return { grouped, grandTotal }
    },
  })

  const toggleProjectCollapsed = (projectNumber: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectNumber]: !(prev[projectNumber] ?? false),
    }))
  }

  const setAllProjectsCollapsed = (collapsed: boolean) => {
    const projectNumbers = Object.keys(unbilledData?.grouped || {})
    setCollapsedProjects(
      projectNumbers.reduce<Record<string, boolean>>((acc, projectNumber) => {
        acc[projectNumber] = collapsed
        return acc
      }, {})
    )
  }

  const getPhaseCollapseKey = (projectNumber: string, phaseName: string) =>
    `${projectNumber}::${phaseName}`

  const togglePhaseCollapsed = (projectNumber: string, phaseName: string) => {
    const phaseKey = getPhaseCollapseKey(projectNumber, phaseName)
    setCollapsedPhases((prev) => ({
      ...prev,
      [phaseKey]: !(prev[phaseKey] ?? false),
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Billables Report — {selectedMonthLabel}</h2>
          <p className="text-sm text-muted-foreground">
            All time entries for the selected month
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {unbilledData && (
            <Card className="px-4 py-2">
              <div className="text-sm text-muted-foreground">Grand Total</div>
              <div className="text-xl font-bold">{formatCurrency(unbilledData.grandTotal)}</div>
            </Card>
          )}
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            Error loading billables data: {error.message}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAllProjectsCollapsed(false)}>
              Expand All
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAllProjectsCollapsed(true)}>
              Collapse All
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(unbilledData?.grouped || {}).map((project) => {
                    const isCollapsed = collapsedProjects[project.project_number] ?? false

                    return (
                      <Fragment key={project.project_number}>
                        <TableRow>
                          <TableCell>
                            <button
                              type="button"
                              className="flex items-center text-left font-medium"
                              onClick={() => toggleProjectCollapsed(project.project_number)}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="mr-1 h-4 w-4" />
                              ) : (
                                <ChevronDown className="mr-1 h-4 w-4" />
                              )}
                              {project.project_number} {project.project_name}
                            </button>
                          </TableCell>
                          <TableCell className="text-right font-bold font-mono">
                            {formatCurrency(project.total)}
                          </TableCell>
                        </TableRow>
                        {isCollapsed ? null : (
                          <TableRow>
                            <TableCell colSpan={2} className="bg-muted/20">
                              <div className="space-y-4 py-2 pl-6">
                                {Object.values(project.phases).map((phase) => (
                                  <div key={phase.phase_name} className="space-y-2">
                                    {(() => {
                                      const phaseCollapseKey = getPhaseCollapseKey(
                                        project.project_number,
                                        phase.phase_name
                                      )
                                      const isPhaseCollapsed = collapsedPhases[phaseCollapseKey] ?? false

                                      return (
                                        <>
                                          <div className="flex items-center justify-between border-b pb-1">
                                            <button
                                              type="button"
                                              className="flex items-center text-left font-medium text-sm"
                                              onClick={() =>
                                                togglePhaseCollapsed(project.project_number, phase.phase_name)
                                              }
                                            >
                                              {isPhaseCollapsed ? (
                                                <ChevronRight className="mr-1 h-4 w-4" />
                                              ) : (
                                                <ChevronDown className="mr-1 h-4 w-4" />
                                              )}
                                              {phase.phase_name}
                                            </button>
                                            <span className="font-medium text-sm">{formatCurrency(phase.total)}</span>
                                          </div>

                                          {isPhaseCollapsed ? null : (
                                            <div className="pl-6">
                                              <Table className="w-full table-fixed">
                                                <TableHeader>
                                                  <TableRow>
                                                    <TableHead className="w-[220px]">Employee</TableHead>
                                                    <TableHead className="w-[120px]">Date</TableHead>
                                                    <TableHead className="w-[100px] text-right">Hours</TableHead>
                                                    <TableHead className="w-[120px] text-right">Rate</TableHead>
                                                    <TableHead className="w-[120px] text-right">Amount</TableHead>
                                                    <TableHead>Notes</TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {Object.values(phase.employees).map((emp) => (
                                                    <Fragment key={emp.employee_name}>
                                                      {emp.entries.map((entry) => (
                                                        <TableRow key={entry.id}>
                                                          <TableCell className="w-[220px]">
                                                            {entry.employee_name}
                                                          </TableCell>
                                                          <TableCell className="w-[120px]">
                                                            {formatDate(entry.entry_date)}
                                                          </TableCell>
                                                          <TableCell className="w-[100px] text-right font-mono">
                                                            {formatHours(entry.hours)}
                                                          </TableCell>
                                                          <TableCell className="w-[120px] text-right font-mono">
                                                            {entry.is_rate_unresolved ? 'Unresolved' : formatCurrency(entry.hourly_rate)}
                                                          </TableCell>
                                                          <TableCell className="w-[120px] text-right font-mono">
                                                            {formatCurrency(entry.amount)}
                                                          </TableCell>
                                                          <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                                                            {entry.notes || '—'}
                                                          </TableCell>
                                                        </TableRow>
                                                      ))}
                                                      <TableRow className="bg-muted/50">
                                                        <TableCell colSpan={4} className="text-right font-medium">
                                                          Total {emp.employee_name}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold font-mono">
                                                          {formatCurrency(emp.total)}
                                                        </TableCell>
                                                        <TableCell />
                                                      </TableRow>
                                                    </Fragment>
                                                  ))}
                                                </TableBody>
                                              </Table>
                                            </div>
                                          )}
                                        </>
                                      )
                                    })()}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {!isLoading && Object.keys(unbilledData?.grouped || {}).length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No time entries found for the selected month
          </CardContent>
        </Card>
      )}
    </div>
  )
}
