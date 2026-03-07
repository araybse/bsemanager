'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils/format'
import { FileText, ArrowRight, DollarSign, Clock, Receipt } from 'lucide-react'
import Link from 'next/link'
import type { Views } from '@/lib/types/database'
import { Badge } from '@/components/ui/badge'
import {
  freshnessBadgeVariant,
  freshnessLabel,
  getFreshnessState,
  type FreshnessState,
} from '@/lib/ops/freshness'
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ComposedChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const PIE_COLORS = ['#111827', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB']

function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isInteger(year) || !Number.isInteger(month)) return monthKey
  const date = new Date(year, month - 1, 1)
  const shortMonth = date.toLocaleString('en-US', { month: 'short' })
  return `${shortMonth} '${String(year).slice(-2)}`
}

export default function DashboardPage() {
  const supabase = createClient()
  const [laborWindow, setLaborWindow] = useState<'month' | 'quarter'>('quarter')

  // Fetch billing candidates
  const { data: billingCandidates, isLoading: loadingCandidates } = useQuery({
    queryKey: ['billing-candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_candidates')
        .select('*')
      if (error) throw error
      return data as Views<'billing_candidates'>[]
    },
  })

  // Fetch backlog summary
  const { data: backlog, isLoading: loadingBacklog } = useQuery({
    queryKey: ['backlog-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backlog_summary')
        .select('*')
        .single()
      if (error) throw error
      return data as Views<'backlog_summary'>
    },
  })

  // Fetch accounts receivable
  const { data: arData, isLoading: loadingAR } = useQuery({
    queryKey: ['accounts-receivable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable_view')
        .select('*')
      if (error) throw error
      const typedData = data as Views<'accounts_receivable_view'>[]
      const total = typedData?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
      return { invoices: typedData, total }
    },
  })

  const { data: invoiceTrend, isLoading: loadingInvoiceTrend } = useQuery({
    queryKey: ['dashboard-invoice-trend'],
    queryFn: async () => {
      const currentMonthStart = new Date()
      currentMonthStart.setDate(1)
      const firstMonth = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 12, 1)
      const sinceDate = firstMonth.toISOString().slice(0, 10)
      const currentMonthStartDate = currentMonthStart.toISOString().slice(0, 10)
      const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const months = Array.from({ length: 12 }, (_, index) => {
        const monthDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1)
        return monthKey(monthDate)
      })

      const [invoiceResp, timeResp] = await Promise.all([
        supabase
          .from('invoices')
          .select('date_issued, amount')
          .gte('date_issued' as never, sinceDate as never)
          .lt('date_issued' as never, currentMonthStartDate as never),
        supabase
          .from('time_entries')
          .select('id, employee_id, employee_name, entry_date, project_number, project_id, hours')
          .gte('entry_date' as never, sinceDate as never)
          .lt('entry_date' as never, currentMonthStartDate as never),
      ])
      if (invoiceResp.error) throw invoiceResp.error
      if (timeResp.error) throw timeResp.error

      const typedEntries =
        ((timeResp.data as
          | Array<{
              id: number
              employee_id: string | null
              employee_name: string
              entry_date: string
              project_number: string
              project_id: number | null
              hours: number
            }>
          | null) || [])

      const entryIds = typedEntries.map((entry) => entry.id)
      const projectIds = Array.from(new Set(typedEntries.map((entry) => entry.project_id).filter(Boolean)))
      const employeeIds = Array.from(
        new Set(typedEntries.map((entry) => entry.employee_id).filter((value): value is string => Boolean(value)))
      )

      const snapRates: Array<{ time_entry_id: number; resolved_hourly_rate: number }> = []
      if (entryIds.length) {
        const chunkSize = 500
        for (let i = 0; i < entryIds.length; i += chunkSize) {
          const chunk = entryIds.slice(i, i + chunkSize)
          const { data, error } = await supabase
            .from('time_entry_bill_rates')
            .select('time_entry_id, resolved_hourly_rate')
            .in('time_entry_id' as never, chunk as never)
          if (error) throw error
          snapRates.push(...(((data || []) as Array<{ time_entry_id: number; resolved_hourly_rate: number }>))
        }
      }

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
      ;(snapRates || []).forEach((row) => {
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
      ;((scheduleItems as Array<{ schedule_id: number; position_id: number; hourly_rate: number }> | null) || []).forEach(
        (row) => {
          scheduleRateByScheduleAndPosition.set(`${row.schedule_id}::${row.position_id}`, Number(row.hourly_rate) || 0)
        }
      )

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

      const excludedProjectSections = new Set(['paid', 'holiday', 'general', 'business'])
      const invoiceBuckets = new Map<string, number>()
      const billableBuckets = new Map<string, number>()

      ;((invoiceResp.data as Array<{ date_issued: string; amount: number | null }> | null) || []).forEach((row) => {
        const key = (row.date_issued || '').slice(0, 7)
        if (!key) return
        invoiceBuckets.set(key, (invoiceBuckets.get(key) || 0) + (Number(row.amount) || 0))
      })

      typedEntries.forEach((entry) => {
        const projectKey = (entry.project_number || '').trim().toLowerCase()
        if (!projectKey || excludedProjectSections.has(projectKey)) return

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

        if (entry.project_id && positionId) {
          const overrideKey = `${entry.project_id}::${positionId}`
          const override = (overridesByProjectAndPosition.get(overrideKey) || [])
            .filter(
              (row) =>
                (!row.effective_from || row.effective_from <= entry.entry_date) &&
                (!row.effective_to || row.effective_to >= entry.entry_date)
            )
            .sort((a, b) => ((a.effective_from || '') > (b.effective_from || '') ? -1 : 1))[0]
          if (override) resolvedRate = Number(override.hourly_rate) || 0
        }

        if (resolvedRate === null && scheduleId && positionId) {
          const scheduleRate = scheduleRateByScheduleAndPosition.get(`${scheduleId}::${positionId}`)
          if (typeof scheduleRate === 'number') resolvedRate = scheduleRate
        }

        const snapshotRate = snapRateByEntryId.get(entry.id)
        const hourlyRate = snapshotRate ?? resolvedRate ?? 0
        const month = (entry.entry_date || '').slice(0, 7)
        if (!month) return
        billableBuckets.set(month, (billableBuckets.get(month) || 0) + (Number(entry.hours) || 0) * hourlyRate)
      })

      return months.map((month) => ({
        month,
        monthLabel: formatMonthLabel(month),
        invoiceAmount: invoiceBuckets.get(month) || 0,
        billableAmount: billableBuckets.get(month) || 0,
      }))
    },
  })

  const { data: laborRoleData, isLoading: loadingLaborRole } = useQuery({
    queryKey: ['dashboard-labor-role', laborWindow],
    queryFn: async () => {
      const since = new Date()
      if (laborWindow === 'month') {
        since.setDate(1)
      } else {
        since.setMonth(since.getMonth() - 2)
      }

      const [timeResp, profileResp] = await Promise.all([
        supabase
          .from('time_entries')
          .select('employee_name, labor_cost')
          .gte('entry_date' as never, since.toISOString().slice(0, 10) as never),
        supabase.from('profiles').select('full_name, role'),
      ])

      if (timeResp.error) throw timeResp.error
      if (profileResp.error) throw profileResp.error

      const roleByName = new Map<string, string>()
      ;(
        (profileResp.data as Array<{ full_name: string | null; role: string | null }> | null) || []
      ).forEach((profile) => {
        const key = (profile.full_name || '').trim().toLowerCase()
        if (key) roleByName.set(key, profile.role || 'employee')
      })

      const totals = new Map<string, number>()
      ;(
        (timeResp.data as Array<{ employee_name: string | null; labor_cost: number | null }> | null) || []
      ).forEach((entry) => {
        const key = (entry.employee_name || '').trim().toLowerCase()
        const role = roleByName.get(key) || 'unmapped'
        totals.set(role, (totals.get(role) || 0) + (Number(entry.labor_cost) || 0))
      })

      return Array.from(totals.entries())
        .map(([role, amount]) => ({ role, amount }))
        .sort((a, b) => b.amount - a.amount)
    },
  })

  const { data: opsFreshness, isLoading: loadingOpsFreshness } = useQuery({
    queryKey: ['dashboard-ops-freshness'],
    queryFn: async () => {
      const [syncResp, qualityResp] = await Promise.all([
        supabase
          .from('sync_runs')
          .select('finished_at')
          .eq('status', 'success')
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('data_quality_runs')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (syncResp.error) throw syncResp.error
      if (qualityResp.error) throw qualityResp.error

      const syncAt = (syncResp.data as { finished_at: string | null } | null)?.finished_at || null
      const qualityAt =
        (qualityResp.data as { created_at: string | null } | null)?.created_at || null
      const syncState = getFreshnessState(syncAt, 24, 72)
      const qualityState = getFreshnessState(qualityAt, 24, 72)
      const state =
        syncState === 'critical' || qualityState === 'critical'
          ? 'critical'
          : syncState === 'stale' || qualityState === 'stale'
            ? 'stale'
            : syncState === 'unknown' || qualityState === 'unknown'
              ? 'unknown'
              : 'fresh'
      return { state, syncAt, qualityAt }
    },
  })
  const opsState = ((opsFreshness?.state as FreshnessState | undefined) || 'unknown') as FreshnessState

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backlog</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingBacklog ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-xl font-bold truncate">
                  {formatCurrency(backlog?.total_backlog)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {backlog?.project_count || 0} active projects
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accounts Receivable</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingAR ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-xl font-bold truncate">
                  {formatCurrency(arData?.total)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {arData?.invoices?.length || 0} unpaid invoices
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready to Bill</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingCandidates ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-xl font-bold">
                  {billingCandidates?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Projects with billable activity
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ops Freshness</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingOpsFreshness ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <Badge variant={freshnessBadgeVariant(opsState)}>
                  {freshnessLabel(opsState)}
                </Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  Last sync:{' '}
                  {opsFreshness?.syncAt ? new Date(opsFreshness.syncAt).toLocaleString() : 'none'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last quality run:{' '}
                  {opsFreshness?.qualityAt
                    ? new Date(opsFreshness.qualityAt).toLocaleString()
                    : 'none'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Invoices vs billables by month (last 12 months, excluding current)</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {loadingInvoiceTrend ? (
              <Skeleton className="h-full w-full" />
            ) : (invoiceTrend?.length || 0) === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No invoice data found in the last 6 months.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={invoiceTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monthLabel" />
                  <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                  <Bar dataKey="invoiceAmount" fill="#111827" radius={[4, 4, 0, 0]} name="Invoiced" />
                  <Line
                    type="monotone"
                    dataKey="billableAmount"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    name="Billable"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Labor Cost by Role</CardTitle>
                <CardDescription>
                  {laborWindow === 'month' ? 'Current month' : 'Last 90 days'}
                </CardDescription>
              </div>
              <Select
                value={laborWindow}
                onValueChange={(value) => setLaborWindow(value as 'month' | 'quarter')}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Current Month</SelectItem>
                  <SelectItem value="quarter">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="h-[280px]">
            {loadingLaborRole ? (
              <Skeleton className="h-full w-full" />
            ) : (laborRoleData?.length || 0) === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No labor cost data found for the selected window.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={laborRoleData || []}
                    dataKey="amount"
                    nameKey="role"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(entry) => {
                      const labelName = String(entry.name || '')
                      const pct = Number(entry.percent || 0) * 100
                      return `${labelName} ${pct.toFixed(0)}%`
                    }}
                  >
                    {(laborRoleData || []).map((entry, index) => (
                      <Cell key={entry.role} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Billing Candidates */}
      <Card>
        <CardHeader>
          <CardTitle>Projects Ready to Bill</CardTitle>
          <CardDescription>
            Projects with lump sum entries, unbilled time, or reimbursables
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingCandidates ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : billingCandidates && billingCandidates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Project #</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingCandidates.map((project) => (
                  <TableRow key={project.project_id} className="hover:bg-muted/50">
                    <TableCell className="font-mono font-medium">
                      <Link href={`/projects/${project.project_id}`} className="block">
                        {project.project_number}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/projects/${project.project_id}`} className="block">
                        {project.project_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/invoices/generate/${project.project_id}`}>
                            <FileText className="mr-2 h-4 w-4" />
                            Generate
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/projects/${project.project_id}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No projects ready to bill this month
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
