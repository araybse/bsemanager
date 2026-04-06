'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/format'

type RatePosition = { id: number; name: string; sort_order: number; is_active: boolean }
type RateSchedule = { id: number; year_label: number; name: string; is_active: boolean }
type RateScheduleItem = { id: number; schedule_id: number; position_id: number; hourly_rate: number }
type ProjectRateAssignment = {
  id: number
  project_id: number
  schedule_id: number
  source: 'proposal_default' | 'manual_override'
}
type ProjectRateOverride = {
  id: number
  project_id: number
  position_id: number
  hourly_rate: number
  effective_from: string | null
  effective_to: string | null
  reason: string | null
}
type Proposal = { id: number; proposal_number: string; date_submitted: string | null }
type ProjectWithProposal = {
  id: number
  project_number: string
  name: string
  proposal_id: number | null
  proposals: Proposal | null
}
type ProfileRow = { id: string; full_name: string; rate_position_id: number | null }
type EmployeeTimelineRow = {
  id: number
  employee_id: string
  employee_name: string
  title: string
  rate_position_id: number | null
  effective_from: string
  effective_to: string | null
  is_current: boolean
}
type TimeEntryDuplicateProbe = {
  id: number
  employee_name: string
  entry_date: string
  project_number: string
  phase_name: string
  hours: number
  notes: string | null
  qb_time_id: string | null
}

export function ScheduleOfRatesSection() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [selectedYear, setSelectedYear] = useState<string>('2026')
  const [newYearLabel, setNewYearLabel] = useState('')
  const [cloneFromYear, setCloneFromYear] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [newOverride, setNewOverride] = useState({
    position_id: '',
    hourly_rate: '',
    effective_from: '',
    effective_to: '',
    reason: '',
  })
  const [newTimeline, setNewTimeline] = useState({
    position_id: '',
    effective_from: '',
  })

  const { data: positions, isLoading: loadingPositions } = useQuery({
    queryKey: ['rate-positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_positions')
        .select('id, name, sort_order, is_active')
        .order('sort_order')
      if (error) throw error
      return (data || []) as RatePosition[]
    },
  })

  const { data: schedules, isLoading: loadingSchedules } = useQuery({
    queryKey: ['rate-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_schedules')
        .select('id, year_label, name, is_active')
        .order('year_label', { ascending: false })
      if (error) throw error
      return (data || []) as RateSchedule[]
    },
  })

  const { data: scheduleItems } = useQuery({
    queryKey: ['rate-schedule-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_schedule_items')
        .select('id, schedule_id, position_id, hourly_rate')
      if (error) throw error
      return (data || []) as RateScheduleItem[]
    },
  })

  const { data: proposals } = useQuery({
    queryKey: ['proposals-for-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('id, proposal_number, date_submitted')
        .order('proposal_number')
      if (error) throw error
      return (data || []) as Proposal[]
    },
  })

  const { data: projects } = useQuery({
    queryKey: ['projects-for-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_number, name, proposal_id, proposals(id, proposal_number, date_submitted)')
        .order('project_number')
      if (error) throw error
      return (data || []) as ProjectWithProposal[]
    },
  })

  const { data: assignments } = useQuery({
    queryKey: ['project-rate-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_rate_schedule_assignments')
        .select('id, project_id, schedule_id, source')
      if (error) throw error
      return (data || []) as ProjectRateAssignment[]
    },
  })

  const { data: overrides } = useQuery({
    queryKey: ['project-rate-overrides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_rate_position_overrides')
        .select('id, project_id, position_id, hourly_rate, effective_from, effective_to, reason')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as ProjectRateOverride[]
    },
  })

  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-position-timeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, rate_position_id')
        .order('full_name')
      if (error) throw error
      return (data || []) as ProfileRow[]
    },
  })

  const { data: timelineRows } = useQuery({
    queryKey: ['employee-title-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_title_history')
        .select('id, employee_id, employee_name, title, rate_position_id, effective_from, effective_to, is_current')
        .order('effective_from', { ascending: false })
      if (error) throw error
      return (data || []) as EmployeeTimelineRow[]
    },
  })

  const { data: duplicateProbeRows } = useQuery({
    queryKey: ['time-entry-duplicate-probe'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('id, employee_name, entry_date, project_number, phase_name, hours, notes, qb_time_id')
        .order('entry_date', { ascending: false })
        .limit(15000)
      if (error) throw error
      return (data || []) as TimeEntryDuplicateProbe[]
    },
  })

  const activePositions = useMemo(
    () => (positions || []).filter((position) => position.is_active),
    [positions]
  )
  const selectedSchedule = useMemo(() => {
    if (!selectedYear) return (schedules || [])[0] || null
    return (schedules || []).find((schedule) => String(schedule.year_label) === selectedYear) || null
  }, [schedules, selectedYear])
  const selectedScheduleId = selectedSchedule?.id || null

  const scheduleRateByPosition = useMemo(() => {
    const map = new Map<number, RateScheduleItem>()
    if (!selectedScheduleId) return map
    ;(scheduleItems || [])
      .filter((item) => item.schedule_id === selectedScheduleId)
      .forEach((item) => map.set(item.position_id, item))
    return map
  }, [scheduleItems, selectedScheduleId])

  const assignmentByProjectId = useMemo(() => {
    const map = new Map<number, ProjectRateAssignment>()
    ;(assignments || []).forEach((assignment) => map.set(assignment.project_id, assignment))
    return map
  }, [assignments])

  const scheduleIdByYear = useMemo(() => {
    const map = new Map<number, number>()
    ;(schedules || []).forEach((schedule) => map.set(schedule.year_label, schedule.id))
    return map
  }, [schedules])

  const selectedProjectOverrides = useMemo(
    () => (overrides || []).filter((override) => String(override.project_id) === selectedProjectId),
    [overrides, selectedProjectId]
  )

  const selectedEmployeeTimeline = useMemo(
    () =>
      (timelineRows || [])
        .filter((row) => row.employee_id === selectedEmployeeId)
        .sort((a, b) => (a.effective_from > b.effective_from ? 1 : -1)),
    [timelineRows, selectedEmployeeId]
  )

  const unresolvedCounts = useMemo(() => {
    const assignmentMissing = (projects || []).filter((project) => !assignmentByProjectId.has(project.id)).length
    const timelineMissing = (profiles || []).filter(
      (profile) => !(timelineRows || []).some((row) => row.employee_id === profile.id)
    ).length
    const scheduleRateMissing = activePositions.filter(
      (position) => !scheduleRateByPosition.has(position.id)
    ).length
    return { assignmentMissing, timelineMissing, scheduleRateMissing }
  }, [projects, assignmentByProjectId, profiles, timelineRows, activePositions, scheduleRateByPosition])

  const duplicateDiagnostics = useMemo(() => {
    const strictClusterMap = new Map<string, TimeEntryDuplicateProbe[]>()
    const qbIdMap = new Map<string, TimeEntryDuplicateProbe[]>()

    ;(duplicateProbeRows || []).forEach((row) => {
      const strictKey = [
        (row.employee_name || '').trim().toLowerCase(),
        row.entry_date,
        (row.project_number || '').trim().toLowerCase(),
        (row.phase_name || '').trim().toLowerCase(),
        Number(row.hours || 0).toFixed(4),
        (row.notes || '').trim().toLowerCase(),
      ].join('::')
      const strictRows = strictClusterMap.get(strictKey) || []
      strictRows.push(row)
      strictClusterMap.set(strictKey, strictRows)

      if (row.qb_time_id) {
        const qbRows = qbIdMap.get(row.qb_time_id) || []
        qbRows.push(row)
        qbIdMap.set(row.qb_time_id, qbRows)
      }
    })

    const strictClusters = Array.from(strictClusterMap.values())
      .filter((rows) => rows.length > 1)
      .sort((a, b) => b.length - a.length)

    const duplicateQbIds = Array.from(qbIdMap.entries())
      .filter(([, rows]) => rows.length > 1)
      .map(([qbTimeId, rows]) => ({ qbTimeId, count: rows.length }))
      .sort((a, b) => b.count - a.count)

    return {
      strictClusters,
      duplicateQbIds,
    }
  }, [duplicateProbeRows])

  const refreshRatesData = () => {
    queryClient.invalidateQueries({ queryKey: ['rate-schedules'] })
    queryClient.invalidateQueries({ queryKey: ['rate-schedule-items'] })
    queryClient.invalidateQueries({ queryKey: ['project-rate-assignments'] })
    queryClient.invalidateQueries({ queryKey: ['projects-for-rates'] })
    queryClient.invalidateQueries({ queryKey: ['project-rate-overrides'] })
    queryClient.invalidateQueries({ queryKey: ['profiles'] })
    queryClient.invalidateQueries({ queryKey: ['profiles-for-position-timeline'] })
    queryClient.invalidateQueries({ queryKey: ['employee-title-history'] })
  }

  const handleRateSave = async (positionId: number, value: string) => {
    if (!selectedScheduleId) return
    const hourlyRate = Number(value)
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      toast.error('Enter a valid hourly rate')
      return
    }
    const existing = scheduleRateByPosition.get(positionId)
    if (existing) {
      const { error } = await supabase
        .from('rate_schedule_items')
        .update({ hourly_rate: hourlyRate, updated_at: new Date().toISOString() } as never)
        .eq('id', existing.id)
      if (error) {
        toast.error(error.message || 'Failed to update rate')
        return
      }
    } else {
      const { error } = await supabase.from('rate_schedule_items').insert({
        schedule_id: selectedScheduleId,
        position_id: positionId,
        hourly_rate: hourlyRate,
      } as never)
      if (error) {
        toast.error(error.message || 'Failed to create rate')
        return
      }
    }
    refreshRatesData()
  }

  const handleCreateSchedule = async () => {
    const nextYear = Number(newYearLabel)
    if (!Number.isInteger(nextYear) || newYearLabel.length !== 4) {
      toast.error('Enter a valid 4-digit year')
      return
    }
    const { data: created, error } = await supabase
      .from('rate_schedules')
      .insert({
        year_label: nextYear,
        name: `Schedule of Rates ${nextYear}`,
        is_active: true,
      } as never)
      .select('id, year_label')
      .single()
    if (error) {
      toast.error(error.message || 'Failed to create schedule year')
      return
    }

    const cloneYear = Number(cloneFromYear)
    const cloneScheduleId = scheduleIdByYear.get(cloneYear)
    if (cloneScheduleId) {
      const cloneItems = (scheduleItems || []).filter((item) => item.schedule_id === cloneScheduleId)
      if (cloneItems.length > 0) {
        const { error: cloneError } = await supabase.from('rate_schedule_items').insert(
          cloneItems.map((item) => ({
            schedule_id: (created as { id: number }).id,
            position_id: item.position_id,
            hourly_rate: item.hourly_rate,
          })) as never
        )
        if (cloneError) {
          toast.error(cloneError.message || 'Schedule created but cloning failed')
        }
      }
    }

    toast.success('Schedule year created')
    setSelectedYear(String((created as { year_label: number }).year_label))
    setNewYearLabel('')
    refreshRatesData()
  }

  const handleToggleScheduleActive = async (schedule: RateSchedule) => {
    const { error } = await supabase
      .from('rate_schedules')
      .update({ is_active: !schedule.is_active, updated_at: new Date().toISOString() } as never)
      .eq('id', schedule.id)
    if (error) {
      toast.error(error.message || 'Failed to update schedule status')
      return
    }
    refreshRatesData()
  }

  const handleProjectProposalChange = async (projectId: number, proposalIdValue: string) => {
    const nextProposalId = proposalIdValue === 'none' ? null : Number(proposalIdValue)
    const { error } = await supabase
      .from('projects')
      .update({ proposal_id: nextProposalId, updated_at: new Date().toISOString() } as never)
      .eq('id', projectId)
    if (error) {
      toast.error(error.message || 'Failed to update project proposal')
      return
    }

    if (!nextProposalId) {
      refreshRatesData()
      return
    }

    const proposal = (proposals || []).find((item) => item.id === nextProposalId)
    const year = proposal?.date_submitted ? Number(proposal.date_submitted.slice(0, 4)) : null
    const scheduleId = year ? scheduleIdByYear.get(year) : undefined
    if (!scheduleId) {
      toast.warning('Proposal updated, but no schedule exists for proposal year')
      refreshRatesData()
      return
    }

    const { error: assignmentError } = await supabase.from('project_rate_schedule_assignments').upsert(
      {
        project_id: projectId,
        schedule_id: scheduleId,
        source: 'proposal_default',
        set_at: new Date().toISOString(),
      } as never,
      { onConflict: 'project_id' }
    )
    if (assignmentError) {
      toast.error(assignmentError.message || 'Proposal updated, assignment failed')
    } else {
      toast.success('Project proposal and default schedule updated')
    }
    refreshRatesData()
  }

  const handleProjectScheduleChange = async (projectId: number, scheduleIdValue: string) => {
    const scheduleId = Number(scheduleIdValue)
    const { error } = await supabase.from('project_rate_schedule_assignments').upsert(
      {
        project_id: projectId,
        schedule_id: scheduleId,
        source: 'manual_override',
        set_at: new Date().toISOString(),
      } as never,
      { onConflict: 'project_id' }
    )
    if (error) {
      toast.error(error.message || 'Failed to set project schedule override')
      return
    }
    refreshRatesData()
  }

  const addProjectOverride = async () => {
    const projectId = Number(selectedProjectId)
    const positionId = Number(newOverride.position_id)
    const hourlyRate = Number(newOverride.hourly_rate)
    if (!projectId || !positionId || !Number.isFinite(hourlyRate)) {
      toast.error('Project, position, and hourly rate are required')
      return
    }
    const { error } = await supabase.from('project_rate_position_overrides').insert({
      project_id: projectId,
      position_id: positionId,
      hourly_rate: hourlyRate,
      effective_from: newOverride.effective_from || null,
      effective_to: newOverride.effective_to || null,
      reason: newOverride.reason.trim() || null,
      set_at: new Date().toISOString(),
    } as never)
    if (error) {
      toast.error(error.message || 'Failed to add project override')
      return
    }
    setNewOverride({ position_id: '', hourly_rate: '', effective_from: '', effective_to: '', reason: '' })
    refreshRatesData()
  }

  const deleteProjectOverride = async (id: number) => {
    const { error } = await supabase.from('project_rate_position_overrides').delete().eq('id', id)
    if (error) {
      toast.error(error.message || 'Failed to delete override')
      return
    }
    refreshRatesData()
  }

  const addTimelineRow = async () => {
    const employeeId = selectedEmployeeId
    const positionId = Number(newTimeline.position_id)
    if (!employeeId || !positionId || !newTimeline.effective_from) {
      toast.error('Employee, position, and effective start are required')
      return
    }
    const employee = (profiles || []).find((profile) => profile.id === employeeId)
    const position = (positions || []).find((item) => item.id === positionId)
    if (!employee || !position) return

    const existingRows = selectedEmployeeTimeline

    const overlapsExisting = existingRows.some((row) => {
      const startsAfterOrOnRowStart = newTimeline.effective_from >= row.effective_from
      const startsBeforeOrOnRowEnd = !row.effective_to || newTimeline.effective_from <= row.effective_to
      return startsAfterOrOnRowStart && startsBeforeOrOnRowEnd
    })
    if (overlapsExisting) {
      toast.error('Timeline overlap detected. Pick a start date outside existing ranges.')
      return
    }

    const previousRow = [...existingRows]
      .filter((row) => row.effective_from < newTimeline.effective_from)
      .sort((a, b) => (a.effective_from > b.effective_from ? -1 : 1))[0]
    if (previousRow) {
      const endDate = new Date(newTimeline.effective_from)
      endDate.setDate(endDate.getDate() - 1)
      const { error: closePreviousError } = await supabase
        .from('employee_title_history')
        .update({
          effective_to: endDate.toISOString().slice(0, 10),
          is_current: false,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', previousRow.id)
      if (closePreviousError) {
        toast.error(closePreviousError.message || 'Failed to close previous timeline row')
        return
      }
    }

    const { error } = await supabase.from('employee_title_history').insert({
      employee_id: employee.id,
      employee_name: employee.full_name,
      title: position.name,
      rate_position_id: position.id,
      effective_from: newTimeline.effective_from,
      effective_to: null,
      is_current: true,
    } as never)
    if (error) {
      toast.error(error.message || 'Failed to add timeline row')
      return
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ rate_position_id: position.id, title: position.name, updated_at: new Date().toISOString() } as never)
      .eq('id', employee.id)
    if (profileUpdateError) {
      toast.warning('Timeline row saved, but profile title/position update failed')
    }

    setNewTimeline({ position_id: '', effective_from: '' })
    refreshRatesData()
  }

  const deleteTimelineRow = async (id: number) => {
    const { error } = await supabase.from('employee_title_history').delete().eq('id', id)
    if (error) {
      toast.error(error.message || 'Failed to delete timeline row')
      return
    }
    refreshRatesData()
  }

  return (
    <Tabs defaultValue="schedules" className="space-y-4">
      <TabsList>
        <TabsTrigger value="schedules">Schedules</TabsTrigger>
        <TabsTrigger value="project-assignments">Project Assignments</TabsTrigger>
        <TabsTrigger value="project-overrides">Project Overrides</TabsTrigger>
        <TabsTrigger value="employee-timeline">Employee Timeline</TabsTrigger>
        <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
      </TabsList>

      <TabsContent value="schedules" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-2">
              <Label>New Year</Label>
              <Input
                value={newYearLabel}
                onChange={(event) => setNewYearLabel(event.target.value)}
                placeholder="2027"
                className="w-[120px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Clone From Year (optional)</Label>
              <Select value={cloneFromYear} onValueChange={setCloneFromYear}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Start blank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Start blank</SelectItem>
                  {(schedules || []).map((schedule) => (
                    <SelectItem key={`clone-${schedule.id}`} value={String(schedule.year_label)}>
                      {schedule.year_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateSchedule}>Create Year</Button>
            {selectedSchedule ? (
              <Button variant="outline" onClick={() => handleToggleScheduleActive(selectedSchedule)}>
                {selectedSchedule.is_active ? 'Deactivate Year' : 'Activate Year'}
              </Button>
            ) : null}
          </div>

          <Tabs value={selectedYear} onValueChange={setSelectedYear} className="space-y-4">
            <TabsList>
              <TabsTrigger value="2023">2023</TabsTrigger>
              <TabsTrigger value="2024">2024</TabsTrigger>
              <TabsTrigger value="2025">2025</TabsTrigger>
              <TabsTrigger value="2026">2026</TabsTrigger>
            </TabsList>

            {['2023', '2024', '2025', '2026'].map((year) => (
              <TabsContent key={year} value={year} className="space-y-4">
                {loadingSchedules || loadingPositions ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Position</TableHead>
                        <TableHead className="w-[240px] text-right">Hourly Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activePositions.map((position) => {
                        const rateItem = scheduleRateByPosition.get(position.id)
                        return (
                          <TableRow key={position.id}>
                            <TableCell>{position.name}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Input
                                  defaultValue={rateItem ? String(rateItem.hourly_rate) : ''}
                                  onBlur={(event) => handleRateSave(position.id, event.target.value)}
                                  className="w-[140px] text-right font-mono"
                                  placeholder="0.00"
                                />
                                <Badge variant="outline">
                                  {rateItem ? formatCurrency(rateItem.hourly_rate) : 'Unresolved'}
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            ))}
          </Tabs>
      </TabsContent>

      <TabsContent value="project-assignments" className="space-y-3">
          <div className="flex gap-2">
            <Badge variant="secondary">Needs Assignment: {unresolvedCounts.assignmentMissing}</Badge>
            <Badge variant="secondary">Missing Timeline: {unresolvedCounts.timelineMissing}</Badge>
            <Badge variant="secondary">Missing Rates (selected year): {unresolvedCounts.scheduleRateMissing}</Badge>
          </div>
          
          <Tabs defaultValue="2026" className="space-y-4">
            <TabsList>
              <TabsTrigger value="2023">2023</TabsTrigger>
              <TabsTrigger value="2024">2024</TabsTrigger>
              <TabsTrigger value="2025">2025</TabsTrigger>
              <TabsTrigger value="2026">2026</TabsTrigger>
            </TabsList>

            {['2023', '2024', '2025', '2026'].map((yearTab) => {
              const realProjects = (projects || []).filter(p => !p.project_number.startsWith('QB'))
              const yearProjects = realProjects.filter(p => p.project_number.slice(0, 2) === yearTab.slice(2))
              
              return (
                <TabsContent key={yearTab} value={yearTab}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project #</TableHead>
                        <TableHead>Project Name</TableHead>
                        <TableHead>Proposal #</TableHead>
                        <TableHead>Proposal Year</TableHead>
                        <TableHead>Effective Schedule</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {yearProjects.map((project) => {
                        const assignment = assignmentByProjectId.get(project.id)
                        const proposalYear = project.proposals?.date_submitted?.slice(0, 4) || '—'
                        return (
                          <TableRow key={project.id}>
                            <TableCell className="font-mono">{project.project_number}</TableCell>
                            <TableCell>{project.name}</TableCell>
                            <TableCell>
                              <Select
                                value={project.proposal_id ? String(project.proposal_id) : 'none'}
                                onValueChange={(value) => handleProjectProposalChange(project.id, value)}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {(proposals || []).map((proposal) => (
                                    <SelectItem key={proposal.id} value={String(proposal.id)}>
                                      {proposal.proposal_number}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>{proposalYear}</TableCell>
                            <TableCell>
                              <Select
                                value={assignment ? String(assignment.schedule_id) : ''}
                                onValueChange={(value) => handleProjectScheduleChange(project.id, value)}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue placeholder="Needs Assignment" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(schedules || []).map((schedule) => (
                                    <SelectItem key={schedule.id} value={String(schedule.id)}>
                                      {schedule.year_label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {assignment ? (
                                <Badge variant={assignment.source === 'manual_override' ? 'default' : 'outline'}>
                                  {assignment.source}
                                </Badge>
                              ) : (
                                <Badge variant="destructive">Needs Assignment</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {yearProjects.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No projects found for {yearTab}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              )
            })}
          </Tabs>
      </TabsContent>

      <TabsContent value="project-overrides" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects || []).map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.project_number} - {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Select
                value={newOverride.position_id}
                onValueChange={(value) => setNewOverride((prev) => ({ ...prev, position_id: value }))}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {activePositions.map((position) => (
                    <SelectItem key={position.id} value={String(position.id)}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rate</Label>
              <Input
                value={newOverride.hourly_rate}
                onChange={(event) => setNewOverride((prev) => ({ ...prev, hourly_rate: event.target.value }))}
                placeholder="0.00"
                className="w-[120px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input
                type="date"
                value={newOverride.effective_from}
                onChange={(event) => setNewOverride((prev) => ({ ...prev, effective_from: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Effective To</Label>
              <Input
                type="date"
                value={newOverride.effective_to}
                onChange={(event) => setNewOverride((prev) => ({ ...prev, effective_to: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={newOverride.reason}
                onChange={(event) => setNewOverride((prev) => ({ ...prev, reason: event.target.value }))}
                placeholder="Optional reason"
                className="w-[220px]"
              />
            </div>
            <Button onClick={addProjectOverride}>Add Override</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedProjectOverrides.map((override) => (
                <TableRow key={override.id}>
                  <TableCell>
                    {activePositions.find((position) => position.id === override.position_id)?.name ||
                      `Position ${override.position_id}`}
                  </TableCell>
                  <TableCell className="font-mono">{formatCurrency(override.hourly_rate)}</TableCell>
                  <TableCell>{override.effective_from || 'Any'}</TableCell>
                  <TableCell>{override.effective_to || 'Any'}</TableCell>
                  <TableCell>{override.reason || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => deleteProjectOverride(override.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {selectedProjectId && selectedProjectOverrides.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No overrides for this project.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
      </TabsContent>

      <TabsContent value="employee-timeline" className="space-y-4">
          <Tabs value={selectedEmployeeId || (profiles && profiles.length > 0 ? profiles[0].id : '')} onValueChange={setSelectedEmployeeId} className="space-y-4">
            <TabsList>
              {(profiles || []).map((profile) => (
                <TabsTrigger key={profile.id} value={profile.id}>
                  {profile.full_name}
                </TabsTrigger>
              ))}
            </TabsList>

            {(profiles || []).map((profile) => {
              const employeeTimeline = (timelineRows || [])
                .filter((row) => row.employee_id === profile.id)
                .sort((a, b) => (a.effective_from > b.effective_from ? 1 : -1))
              
              return (
                <TabsContent key={profile.id} value={profile.id} className="space-y-4">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Select
                        value={newTimeline.position_id}
                        onValueChange={(value) => setNewTimeline((prev) => ({ ...prev, position_id: value }))}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                        <SelectContent>
                          {activePositions.map((position) => (
                            <SelectItem key={position.id} value={String(position.id)}>
                              {position.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Effective Start</Label>
                      <Input
                        type="date"
                        value={newTimeline.effective_from}
                        onChange={(event) => setNewTimeline((prev) => ({ ...prev, effective_from: event.target.value }))}
                      />
                    </div>
                    <Button onClick={addTimelineRow}>Add Promotion Row</Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Position</TableHead>
                        <TableHead>Effective Start</TableHead>
                        <TableHead>Effective End</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeTimeline.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.title}</TableCell>
                          <TableCell>{row.effective_from}</TableCell>
                          <TableCell>{row.effective_to || 'Current'}</TableCell>
                          <TableCell>
                            <Badge variant={row.is_current ? 'default' : 'outline'}>
                              {row.is_current ? 'Current' : 'Historical'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => deleteTimelineRow(row.id)}>
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {employeeTimeline.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No timeline rows for {profile.full_name}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              )
            })}
          </Tabs>
      </TabsContent>

      <TabsContent value="diagnostics" className="flex flex-wrap gap-2">
          <Badge variant={unresolvedCounts.assignmentMissing === 0 ? 'outline' : 'destructive'}>
            Missing Project Schedules: {unresolvedCounts.assignmentMissing}
          </Badge>
          <Badge variant={unresolvedCounts.timelineMissing === 0 ? 'outline' : 'destructive'}>
            Missing Employee Timelines: {unresolvedCounts.timelineMissing}
          </Badge>
          <Badge variant={unresolvedCounts.scheduleRateMissing === 0 ? 'outline' : 'destructive'}>
            Missing Position Rates (Selected Year): {unresolvedCounts.scheduleRateMissing}
          </Badge>
      </TabsContent>

      <TabsContent value="duplicates" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant={duplicateDiagnostics.strictClusters.length === 0 ? 'outline' : 'destructive'}>
              Strict Duplicate Clusters: {duplicateDiagnostics.strictClusters.length}
            </Badge>
            <Badge variant={duplicateDiagnostics.duplicateQbIds.length === 0 ? 'outline' : 'destructive'}>
              Duplicate QB Time IDs: {duplicateDiagnostics.duplicateQbIds.length}
            </Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duplicateDiagnostics.duplicateQbIds.slice(0, 10).map((item) => (
                <TableRow key={`qb-${item.qbTimeId}`}>
                  <TableCell>QB Time ID</TableCell>
                  <TableCell className="font-mono">{item.qbTimeId}</TableCell>
                  <TableCell>{item.count}</TableCell>
                </TableRow>
              ))}
              {duplicateDiagnostics.strictClusters.slice(0, 10).map((cluster, index) => (
                <TableRow key={`strict-${index}`}>
                  <TableCell>Content Cluster</TableCell>
                  <TableCell>
                    {cluster[0].employee_name} · {cluster[0].entry_date} · {cluster[0].project_number} · {cluster[0].phase_name}
                  </TableCell>
                  <TableCell>{cluster.length}</TableCell>
                </TableRow>
              ))}
              {duplicateDiagnostics.duplicateQbIds.length === 0 &&
              duplicateDiagnostics.strictClusters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No duplicate indicators in sampled entries.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
      </TabsContent>
    </Tabs>
  )
}
