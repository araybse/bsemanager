'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
} from 'recharts'

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

  // Get current user and role
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('id', user.id)
        .single()
      
      if (error) throw error
      return profile as { id: string; role: string; full_name: string | null; email: string }
    },
  })

  const userRole = currentUser?.role as 'admin' | 'project_manager' | 'employee' | 'client' | undefined

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
      const nextMonthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 1)
      const firstMonth = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 12, 1)
      const sinceDate = firstMonth.toISOString().slice(0, 10)
      const nextMonthStartDate = nextMonthStart.toISOString().slice(0, 10)
      const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const months = Array.from({ length: 12 }, (_, index) => {
        const monthDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1)
        return monthKey(monthDate)
      })

      const invoiceRows: Array<{ date_issued: string; amount: number | null }> = []
      const timeRows: Array<{
        id: number
        employee_id: string | null
        employee_name: string
        entry_date: string
        project_number: string
        project_id: number | null
        hours: number
      }> = []
      const pageSize = 1000

      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from('invoices')
          .select('date_issued, amount')
          .gte('date_issued' as never, sinceDate as never)
          .lt('date_issued' as never, nextMonthStartDate as never)
          .order('date_issued', { ascending: true })
          .range(from, from + pageSize - 1)
        if (error) throw error
        const batch = ((data || []) as Array<{ date_issued: string; amount: number | null }>)
        invoiceRows.push(...batch)
        if (batch.length < pageSize) break
        from += pageSize
      }

      from = 0
      while (true) {
        const { data, error} = await supabase
          .from('time_entries')
          .select('id, employee_id, employee_name, entry_date, project_number, project_id, hours')
          .gte('entry_date' as never, sinceDate as never)
          .lt('entry_date' as never, nextMonthStartDate as never)
          .order('entry_date', { ascending: true })
          .range(from, from + pageSize - 1)
        if (error) throw error
        const batch = ((data || []) as Array<{
          id: number
          employee_id: string | null
          employee_name: string
          entry_date: string
          project_number: string
          project_id: number | null
          hours: number
        }>)
        timeRows.push(...batch)
        if (batch.length < pageSize) break
        from += pageSize
      }

      const typedEntries =
        ((timeRows as
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
          snapRates.push(...((data || []) as Array<{ time_entry_id: number; resolved_hourly_rate: number }>))
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

      ;(invoiceRows || []).forEach((row) => {
        const issuedDate = row.date_issued ? new Date(`${row.date_issued}T00:00:00`) : null
        if (!issuedDate || Number.isNaN(issuedDate.getTime())) return
        // Invoice month represents prior-month work.
        const serviceMonth = new Date(issuedDate.getFullYear(), issuedDate.getMonth() - 1, 1)
        const key = monthKey(serviceMonth)
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

  const { data: grossProfitVsExpenses, isLoading: loadingGrossProfitVsExpenses } = useQuery({
    queryKey: ['dashboard-gross-profit-vs-expenses-cash'],
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

      const { data: snapshotRows, error: snapshotError } = await supabase
        .from('accounting_snapshots' as never)
        .select('id, period_start, period_end, fetched_at')
        .eq('report_type' as never, 'profit_and_loss' as never)
        .eq('basis' as never, 'cash' as never)
        .gte('period_start' as never, sinceDate as never)
        .lt('period_end' as never, currentMonthStartDate as never)
        .order('fetched_at' as never, { ascending: false })
      if (snapshotError) throw snapshotError

      const monthlySnapshotByMonth = new Map<string, { id: number }>()
      ;((snapshotRows as Array<{ id: number; period_start: string; period_end: string; fetched_at: string }> | null) || [])
        .forEach((row) => {
          const startMonth = (row.period_start || '').slice(0, 7)
          const endMonth = (row.period_end || '').slice(0, 7)
          if (!startMonth || startMonth !== endMonth) return
          if (!monthlySnapshotByMonth.has(startMonth)) {
            monthlySnapshotByMonth.set(startMonth, { id: row.id })
          }
        })

      const snapshotIds = Array.from(monthlySnapshotByMonth.values()).map((row) => row.id)
      const lines: Array<{ snapshot_id: number; account_name: string; amount: number | null }> = []
      if (snapshotIds.length > 0) {
        const chunkSize = 100
        for (let i = 0; i < snapshotIds.length; i += chunkSize) {
          const chunk = snapshotIds.slice(i, i + chunkSize)
          const { data, error } = await supabase
            .from('accounting_snapshot_lines' as never)
            .select('snapshot_id, account_name, amount')
            .in('snapshot_id' as never, chunk as never)
          if (error) throw error
          lines.push(...((data || []) as Array<{ snapshot_id: number; account_name: string; amount: number | null }>))
        }
      }

      const grossBySnapshot = new Map<number, number>()
      const expensesBySnapshot = new Map<number, number>()
      lines.forEach((line) => {
        const name = (line.account_name || '').trim().toLowerCase()
        if (name === 'gross profit') grossBySnapshot.set(line.snapshot_id, Number(line.amount) || 0)
        if (name === 'total expenses') expensesBySnapshot.set(line.snapshot_id, Number(line.amount) || 0)
      })

      return months.map((month) => {
        const snapshotId = monthlySnapshotByMonth.get(month)?.id
        return {
          month,
          monthLabel: formatMonthLabel(month),
          grossProfit: snapshotId ? grossBySnapshot.get(snapshotId) || 0 : 0,
          totalExpenses: snapshotId ? expensesBySnapshot.get(snapshotId) || 0 : 0,
        }
      })
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

  // Fetch monthly multipliers (C* phases only) for admin dashboard
  const { data: monthlyMultipliers, isLoading: loadingMonthlyMultipliers } = useQuery({
    queryKey: ['dashboard-monthly-multipliers'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/monthly-multipliers')
      if (!response.ok) throw new Error('Failed to fetch monthly multipliers')
      const data = await response.json()
      return data.monthlyMultipliers as Array<{
        month: string
        monthLabel: string
        revenue: number
        cost: number
        multiplier: number | null
      }>
    },
    enabled: userRole === 'admin', // Only fetch for admin users
  })

  // Show loading state while fetching user
  if (loadingUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Role-based dashboard rendering
  // For now, PM and Employee roles see a placeholder
  // Admin sees the full dashboard
  if (userRole === 'project_manager') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Project Manager Dashboard</CardTitle>
            <CardDescription>Your assigned projects and team performance</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              PM-specific dashboard coming soon. You'll see stats for projects where you're the PM or assigned as a team member.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (userRole === 'employee') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Employee Dashboard</CardTitle>
            <CardDescription>Your time entries and project assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Employee dashboard coming soon. You'll see your recent time entries and assigned projects.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Admin dashboard (current view, minus backlog card)
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
            <CardDescription>Invoices vs billables by month (last 12 months). Invoice month represents prior month work.</CardDescription>
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
            <CardTitle>Cash Basis: Gross Profit vs Expenses</CardTitle>
            <CardDescription>Monthly snapshots from QuickBooks (last 12 months, excluding current)</CardDescription>
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#111827]" />
                Gross Profit
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#6B7280]" />
                Expenses
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-[280px]">
            {loadingGrossProfitVsExpenses ? (
              <Skeleton className="h-full w-full" />
            ) : (grossProfitVsExpenses?.length || 0) === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No cash-basis P&amp;L snapshot data found in the last 12 months.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={grossProfitVsExpenses || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monthLabel" />
                  <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                  <Bar dataKey="grossProfit" fill="#111827" radius={[4, 4, 0, 0]} name="Gross Profit" />
                  <Bar dataKey="totalExpenses" fill="#6B7280" radius={[4, 4, 0, 0]} name="Expenses" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Multipliers Chart (Admin Only) */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Multipliers</CardTitle>
          <CardDescription>
            Project multiplier by month (last 12 months). C-phase revenue ÷ C-phase labor cost.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          {loadingMonthlyMultipliers ? (
            <Skeleton className="h-full w-full" />
          ) : (monthlyMultipliers?.length || 0) === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No multiplier data available for the last 12 months.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyMultipliers || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthLabel" />
                <YAxis tickFormatter={(value) => `${Number(value).toFixed(1)}x`} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(2)}x`} />
                <Line
                  type="monotone"
                  dataKey="multiplier"
                  stroke="#2563EB"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Multiplier"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

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
