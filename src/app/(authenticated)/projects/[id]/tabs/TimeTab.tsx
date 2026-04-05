'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { TabsContent } from '@/components/ui/tabs'
import { formatDate } from '@/lib/utils/dates'
import { formatCurrency, formatHours } from '@/lib/utils/format'

export interface TimeEntry {
  id: number
  entry_date: string
  employee_name: string
  phase_name: string
  hours: number
  labor_cost?: number
  notes?: string | null
}

export interface TimeFilterOptions {
  employees: string[]
  phases: string[]
}

export interface TimeTabProps {
  loadingTime: boolean
  timeFilterStart: string
  setTimeFilterStart: (value: string) => void
  timeFilterEnd: string
  setTimeFilterEnd: (value: string) => void
  timeFilterEmployee: string
  setTimeFilterEmployee: (value: string) => void
  timeFilterPhase: string
  setTimeFilterPhase: (value: string) => void
  timeFilterOptions: TimeFilterOptions
  filteredTimeEntries: TimeEntry[]
  isAdmin: boolean
}

export function TimeTab({
  loadingTime,
  timeFilterStart,
  setTimeFilterStart,
  timeFilterEnd,
  setTimeFilterEnd,
  timeFilterEmployee,
  setTimeFilterEmployee,
  timeFilterPhase,
  setTimeFilterPhase,
  timeFilterOptions,
  filteredTimeEntries,
  isAdmin,
}: TimeTabProps) {
  const handleReset = () => {
    setTimeFilterStart('')
    setTimeFilterEnd('')
    setTimeFilterEmployee('all')
    setTimeFilterPhase('all')
  }

  const totalHours = filteredTimeEntries.reduce(
    (sum, entry) => sum + (Number(entry.hours) || 0),
    0
  )

  const totalAmount = filteredTimeEntries.reduce(
    (sum, entry) => sum + (Number(entry.labor_cost) || 0),
    0
  )

  return (
    <TabsContent value="time" className="mt-4">
      <Card>
        <CardContent className="p-4">
          {loadingTime ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {/* Filters */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Start Date</div>
                  <Input
                    type="date"
                    value={timeFilterStart}
                    onChange={(event) => setTimeFilterStart(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">End Date</div>
                  <Input
                    type="date"
                    value={timeFilterEnd}
                    onChange={(event) => setTimeFilterEnd(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Employee</div>
                  <Select value={timeFilterEmployee} onValueChange={setTimeFilterEmployee}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {timeFilterOptions.employees.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Phase</div>
                  <Select value={timeFilterPhase} onValueChange={setTimeFilterPhase}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="All phases" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {timeFilterOptions.phases.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>

              {/* Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    {isAdmin && <TableHead className="text-right">Amount</TableHead>}
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTimeEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.entry_date)}</TableCell>
                      <TableCell>{entry.employee_name}</TableCell>
                      <TableCell>{entry.phase_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatHours(entry.hours)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right font-mono">
                          {formatCurrency(Number(entry.labor_cost) || 0)}
                        </TableCell>
                      )}
                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                        {entry.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTimeEntries.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 6 : 5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No time entries
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredTimeEntries.length > 0 && (
                    <TableRow className="font-medium bg-muted/20">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatHours(totalHours)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right font-mono">
                          {formatCurrency(totalAmount)}
                        </TableCell>
                      )}
                      <TableCell colSpan={1}></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  )
}
