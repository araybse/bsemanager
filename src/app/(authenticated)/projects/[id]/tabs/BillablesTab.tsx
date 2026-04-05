'use client'

import { Fragment, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TabsContent } from '@/components/ui/tabs'
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
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency, formatHours } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'

interface BillableEntry {
  id: number
  employee_name: string
  entry_date: string
  hours: number
  hourly_rate: number
  amount: number
  is_rate_unresolved: boolean
  notes: string | null
}

interface BillableEmployee {
  employee_name: string
  entries: BillableEntry[]
  total: number
}

interface BillablePhase {
  phase_name: string
  employees: Record<string, BillableEmployee>
  total: number
}

interface ProjectBillablesData {
  projectName: string | null
  phases: Record<string, BillablePhase>
  grandTotal: number
}

export interface BillablesTabProps {
  loadingProjectBillables: boolean
  projectBillables: ProjectBillablesData | undefined | null
  selectedBillablesMonth: string
  setSelectedBillablesMonth: (value: string) => void
  selectedBillablesMonthLabel: string
  billablesMonthOptions: { value: string; label: string }[]
  normalizedProjectNumber: string
  projectName: string | null | undefined
}

export function BillablesTab({
  loadingProjectBillables,
  projectBillables,
  selectedBillablesMonth,
  setSelectedBillablesMonth,
  selectedBillablesMonthLabel,
  billablesMonthOptions,
  normalizedProjectNumber,
  projectName,
}: BillablesTabProps) {
  const [collapsedBillablePhases, setCollapsedBillablePhases] = useState<Record<string, boolean>>({})

  const getBillablePhaseCollapseKey = (phaseName: string) => {
    return `${normalizedProjectNumber}_${phaseName}_${selectedBillablesMonth}`
  }

  const toggleBillablePhaseCollapsed = (phaseName: string) => {
    const key = getBillablePhaseCollapseKey(phaseName)
    setCollapsedBillablePhases((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <TabsContent value="billables" className="mt-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Billables — {selectedBillablesMonthLabel}</h3>
            <p className="text-sm text-muted-foreground">
              Monthly billable detail for this project
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedBillablesMonth} onValueChange={setSelectedBillablesMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {billablesMonthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Card className="px-4 py-2">
              <div className="text-sm text-muted-foreground">Project Total</div>
              <div className="text-xl font-bold">
                {formatCurrency(projectBillables?.grandTotal || 0)}
              </div>
            </Card>
          </div>
        </div>

        {loadingProjectBillables ? (
          <Card>
            <CardContent className="p-4">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {(Object.keys(projectBillables?.phases || {}).length || 0) === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No time entries found for the selected month
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        {normalizedProjectNumber} {projectBillables?.projectName || projectName || ''}
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono">
                        {formatCurrency(projectBillables?.grandTotal || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={2} className="bg-muted/20">
                        <div className="space-y-4 py-2 pl-6">
                          {Object.values(projectBillables?.phases || {}).map((phase) => {
                            const phaseCollapseKey = getBillablePhaseCollapseKey(phase.phase_name)
                            const isPhaseCollapsed = collapsedBillablePhases[phaseCollapseKey] ?? false

                            return (
                              <div key={phase.phase_name} className="space-y-2">
                                <div className="flex items-center justify-between border-b pb-1">
                                  <button
                                    type="button"
                                    className="flex items-center text-left font-medium text-sm"
                                    onClick={() => toggleBillablePhaseCollapsed(phase.phase_name)}
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
                                                  {entry.is_rate_unresolved
                                                    ? 'Unresolved'
                                                    : formatCurrency(entry.hourly_rate)}
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
                              </div>
                            )
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </TabsContent>
  )
}
