'use client'
/* eslint-disable react-hooks/static-components */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatHours } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import type { Tables } from '@/lib/types/database'

type SortField = 'entry_date' | 'employee_name' | 'project_number' | 'phase_name' | 'hours'
type SortDirection = 'asc' | 'desc'

export default function TimeEntriesPage() {
  const supabase = createClient()
  
  // Filter state
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [phaseFilter, setPhaseFilter] = useState<string>('all')
  
  // Sort state
  const [sortField, setSortField] = useState<SortField>('entry_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const { data: timeEntries, isLoading } = useQuery({
    queryKey: ['time-entries'],
    queryFn: async () => {
      const all: Tables<'time_entries'>[] = []
      const pageSize = 1000
      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from('time_entries')
          .select('*')
          .order('entry_date', { ascending: false })
          .range(from, from + pageSize - 1)
        if (error) throw error
        const batch = (data as Tables<'time_entries'>[]) || []
        all.push(...batch)
        if (batch.length < pageSize) break
        from += pageSize
      }
      return all
    },
  })

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    if (!timeEntries) return { employees: [], projects: [], phases: [] }
    
    const employees = [...new Set(timeEntries.map(e => e.employee_name).filter(Boolean))].sort()
    const projects = [...new Set(timeEntries.map(e => e.project_number).filter(Boolean))].sort()
    const phases = [...new Set(timeEntries.map(e => e.phase_name).filter(Boolean))].sort()
    
    return { employees, projects, phases }
  }, [timeEntries])

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    if (!timeEntries) return []
    
    const filtered = timeEntries.filter(entry => {
      // Date range filter
      if (dateFrom && entry.entry_date < dateFrom) return false
      if (dateTo && entry.entry_date > dateTo) return false
      
      // Employee filter
      if (employeeFilter !== 'all' && entry.employee_name !== employeeFilter) return false
      
      // Project filter
      if (projectFilter !== 'all' && entry.project_number !== projectFilter) return false
      
      // Phase filter
      if (phaseFilter !== 'all' && entry.phase_name !== phaseFilter) return false
      
      return true
    })
    
    // Sort
    filtered.sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      
      switch (sortField) {
        case 'entry_date':
          aVal = a.entry_date || ''
          bVal = b.entry_date || ''
          break
        case 'employee_name':
          aVal = a.employee_name || ''
          bVal = b.employee_name || ''
          break
        case 'project_number':
          aVal = a.project_number || ''
          bVal = b.project_number || ''
          break
        case 'phase_name':
          aVal = a.phase_name || ''
          bVal = b.phase_name || ''
          break
        case 'hours':
          aVal = a.hours || 0
          bVal = b.hours || 0
          break
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    
    return filtered
  }, [timeEntries, dateFrom, dateTo, employeeFilter, projectFilter, phaseFilter, sortField, sortDirection])

  // Calculate totals
  const totalHours = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0)
  }, [filteredEntries])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // eslint-disable-next-line react-hooks/static-components
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-4 w-4" />
      : <ArrowDown className="ml-1 h-4 w-4" />
  }

  const clearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setEmployeeFilter('all')
    setProjectFilter('all')
    setPhaseFilter('all')
  }

  const hasActiveFilters = dateFrom || dateTo || employeeFilter !== 'all' || projectFilter !== 'all' || phaseFilter !== 'all'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Time Entries</h2>
        <p className="text-sm text-muted-foreground">
          Time entries imported from QuickBooks Time
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Date From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Date To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Employee</label>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {filterOptions.employees.map(emp => (
                <SelectItem key={emp} value={emp}>{emp}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Project</label>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {filterOptions.projects.map(proj => (
                <SelectItem key={proj} value={proj}>{proj}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Phase</label>
          <Select value={phaseFilter} onValueChange={setPhaseFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Phases" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Phases</SelectItem>
              {filterOptions.phases.map(phase => (
                <SelectItem key={phase} value={phase}>{phase}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{filteredEntries.length} entries</span>
        <span>•</span>
        <span>{formatHours(totalHours)} total hours</span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('entry_date')}
                  >
                    <div className="flex items-center">
                      Date
                      <SortIcon field="entry_date" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('employee_name')}
                  >
                    <div className="flex items-center">
                      Employee
                      <SortIcon field="employee_name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('project_number')}
                  >
                    <div className="flex items-center">
                      Project
                      <SortIcon field="project_number" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('phase_name')}
                  >
                    <div className="flex items-center">
                      Phase
                      <SortIcon field="phase_name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('hours')}
                  >
                    <div className="flex items-center justify-end">
                      Hours
                      <SortIcon field="hours" />
                    </div>
                  </TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.entry_date)}</TableCell>
                    <TableCell>{entry.employee_name}</TableCell>
                    <TableCell className="font-mono">{entry.project_number}</TableCell>
                    <TableCell>{entry.phase_name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatHours(entry.hours)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                      {entry.notes || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.is_billed ? 'default' : 'secondary'}>
                        {entry.is_billed ? 'Billed' : 'Unbilled'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {hasActiveFilters ? 'No entries match the current filters' : 'No time entries found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
