'use client'

import { Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatHours } from '@/lib/utils/format'
import { formatDate, getBillingMonthName } from '@/lib/utils/dates'
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
  employee_name: string
  entry_date: string
  project_number: string
  phase_name: string
  hours: number
  notes: string | null
  hourly_rate: number
  amount: number
  project_name: string
}

type TimeEntryWithProject = Tables<'time_entries'> & {
  projects: { name: string } | null
}

export default function UnbilledReportPage() {
  const supabase = createClient()
  const billingMonth = getBillingMonthName()

  const { data: unbilledData, isLoading, error } = useQuery({
    queryKey: ['unbilled-report'],
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
        .eq('is_billed', false)
        .eq('is_billable', true)
        .order('project_number')
        .order('phase_name')
        .order('employee_name')

      if (timeError) throw timeError

      const typedEntries = timeEntries as unknown as TimeEntryWithProject[]

      // Get rates for each entry
      const entriesWithRates: TimeEntryWithRate[] = []
      
      for (const entry of typedEntries || []) {
        const { data: rate } = await supabase
          .from('billable_rates')
          .select('hourly_rate')
          .eq('project_id' as never, (entry.project_id || 0) as never)
          .eq('employee_name' as never, entry.employee_name as never)
          .maybeSingle()

        const hourlyRate = (rate as { hourly_rate: number } | null)?.hourly_rate || 150 // Default rate if none set
        entriesWithRates.push({
          id: entry.id,
          employee_name: entry.employee_name,
          entry_date: entry.entry_date,
          project_number: entry.project_number,
          phase_name: entry.phase_name,
          hours: entry.hours,
          notes: entry.notes,
          hourly_rate: hourlyRate,
          amount: entry.hours * hourlyRate,
          project_name: entry.projects?.name || '',
        })
      }

      // Group by project, then phase, then employee
      const grouped = entriesWithRates.reduce((acc, entry) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Unbilled Report — {billingMonth} {new Date().getFullYear()}</h2>
          <p className="text-sm text-muted-foreground">
            Time entries pending billing
          </p>
        </div>
        {unbilledData && (
          <Card className="px-4 py-2">
            <div className="text-sm text-muted-foreground">Grand Total</div>
            <div className="text-xl font-bold">{formatCurrency(unbilledData.grandTotal)}</div>
          </Card>
        )}
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            Error loading unbilled data: {error.message}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        Object.values(unbilledData?.grouped || {}).map((project) => (
          <Card key={project.project_number}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {project.project_number} {project.project_name}
                </CardTitle>
                <span className="font-bold">{formatCurrency(project.total)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.values(project.phases).map((phase) => (
                <div key={phase.phase_name} className="space-y-2">
                  <div className="flex items-center justify-between border-b pb-1">
                    <span className="font-medium text-sm">{phase.phase_name}</span>
                    <span className="font-medium text-sm">{formatCurrency(phase.total)}</span>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(phase.employees).map((emp) => (
                        <Fragment key={emp.employee_name}>
                          {emp.entries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>{entry.employee_name}</TableCell>
                              <TableCell>{formatDate(entry.entry_date)}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatHours(entry.hours)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(entry.hourly_rate)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
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
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {!isLoading && Object.keys(unbilledData?.grouped || {}).length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No unbilled time entries found
          </CardContent>
        </Card>
      )}
    </div>
  )
}
