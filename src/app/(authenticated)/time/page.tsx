'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
// Role comes from currentUser query
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line, ReferenceLine } from 'recharts'

export default function TimePage() {
  const supabase = createClient()

  // Dashboard filter state (separate from Entries)
  const [dashboardEmployee, setDashboardEmployee] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month')

  // Entries tab filter state
  const [entriesEmployeeFilter, setEntriesEmployeeFilter] = useState<string>('all')
  const [entriesProjectFilter, setEntriesProjectFilter] = useState<string>('all')
  const [entriesPhaseFilter, setEntriesPhaseFilter] = useState<string>('all')
  const [entriesStartDate, setEntriesStartDate] = useState<string>('')
  const [entriesEndDate, setEntriesEndDate] = useState<string>('')
  const [dateSortDirection, setDateSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [entriesPerPage, setEntriesPerPage] = useState<number>(100)

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', user.id)
        .single()
      return data as { id: string; email: string; full_name: string; role: string } | null
    },
  })

  const userRole = currentUser?.role as 'admin' | 'project_manager' | 'employee' | undefined

  // Get employees list (admin only)
  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name')
      return (data as Array<{ id: string; full_name: string; email: string }>) || []
    },
    enabled: userRole === 'admin',
  })

  // Determine which employee to show data for (Dashboard uses its own filter)
  const effectiveEmployeeId = userRole === 'admin' 
    ? dashboardEmployee 
    : currentUser?.id

  // Utilization data query
  const { data: utilizationData, isLoading: loadingUtilization } = useQuery({
    queryKey: ['utilization-time', selectedPeriod, effectiveEmployeeId],
    queryFn: async () => {
      const params = new URLSearchParams({
        period: selectedPeriod,
        ...(effectiveEmployeeId ? { employee_id: effectiveEmployeeId } : {})
      })
      const response = await fetch(`/api/dashboard/utilization?${params}`)
      if (!response.ok) throw new Error('Failed to fetch utilization')
      const data = await response.json()
      return data.utilization as Array<{
        period: string
        periodLabel: string
        totalHours: number
        projectHours: number
        utilizationRate: number
      }>
    },
  })

  // PTO usage data query
  const { data: ptoData, isLoading: loadingPto } = useQuery({
    queryKey: ['pto-usage-time', selectedPeriod, effectiveEmployeeId],
    queryFn: async () => {
      const params = new URLSearchParams({
        period: selectedPeriod,
        ...(effectiveEmployeeId ? { employee_id: effectiveEmployeeId } : {})
      })
      const response = await fetch(`/api/dashboard/pto-usage?${params}`)
      if (!response.ok) throw new Error('Failed to fetch PTO usage')
      const data = await response.json()
      return data.ptoUsage as Array<{
        period: string
        periodLabel: string
        totalHours: number
        byType: { PTO: number; Vacation: number; Sick: number }
      }>
    },
  })

  // Time entries query - fetch all entries using pagination to bypass 1000-row limit
  const { data: timeEntries, isLoading: loadingEntries } = useQuery({
    queryKey: ['time-entries-list'],
    queryFn: async () => {
      let allData: any[] = []
      let from = 0
      const pageSize = 1000
      
      while (true) {
        const { data, error } = await supabase
          .from('time_entries')
          .select('id, employee_id, employee_name, entry_date, hours, project_number, phase_name')
          .order('entry_date', { ascending: false })
          .range(from, from + pageSize - 1)
        
        if (error) throw error
        if (!data || data.length === 0) break
        
        allData = [...allData, ...data]
        if (data.length < pageSize) break
        from += pageSize
      }
      
      return allData
    },
  })

  // Extract unique projects and phases from time entries for filter dropdowns
  const { uniqueProjects, uniquePhases } = useMemo(() => {
    if (!timeEntries) return { uniqueProjects: [], uniquePhases: [] }
    
    const projects = [...new Set(timeEntries.map((e: any) => e.project_number).filter(Boolean))].sort()
    const phases = [...new Set(timeEntries.map((e: any) => e.phase_name).filter(Boolean))].sort()
    
    return { uniqueProjects: projects, uniquePhases: phases }
  }, [timeEntries])

  // Filter and sort entries client-side
  const filteredEntries = useMemo(() => {
    if (!timeEntries) return []
    
    // ENHANCED DEBUG LOGGING - CRITICAL STATE CHECK
    console.log('🔥 === FILTER RUN START ===')
    console.log('🔍 FILTER STATE CHECK:', {
      entriesEmployeeFilter: entriesEmployeeFilter,
      entriesProjectFilter: entriesProjectFilter,
      entriesPhaseFilter: entriesPhaseFilter,
      entriesStartDate: entriesStartDate,
      entriesEndDate: entriesEndDate,
      startDateType: typeof entriesStartDate,
      endDateType: typeof entriesEndDate,
      startDateLength: entriesStartDate?.length,
      endDateLength: entriesEndDate?.length,
      startDateTruthy: !!entriesStartDate,
      endDateTruthy: !!entriesEndDate,
      startDateIsEmptyString: entriesStartDate === '',
      endDateIsEmptyString: entriesEndDate === '',
      totalEntries: timeEntries.length
    })
    
    if (entriesStartDate || entriesEndDate) {
      console.log('🔍 Date Filter Active - Sample Entry Dates:', 
        timeEntries.slice(0, 5).map((e: any) => ({
          raw: e.entry_date,
          type: typeof e.entry_date,
          length: e.entry_date?.length,
          splitResult: e.entry_date?.split('T')[0]
        }))
      )
    }
    
    let filteredCount = { employee: 0, project: 0, phase: 0, startDate: 0, endDate: 0, passed: 0 }
    
    let filtered: any[] = timeEntries.filter((entry: any) => {
      // Employee filter
      if (entriesEmployeeFilter !== 'all' && entry.employee_id !== entriesEmployeeFilter) {
        filteredCount.employee++
        return false
      }
      
      // Project filter
      if (entriesProjectFilter !== 'all' && entry.project_number !== entriesProjectFilter) {
        filteredCount.project++
        return false
      }
      
      // Phase filter
      if (entriesPhaseFilter !== 'all' && entry.phase_name !== entriesPhaseFilter) {
        filteredCount.phase++
        return false
      }
      
      // Date range filter - inclusive on both ends
      // Normalize entry_date to YYYY-MM-DD format (remove any timestamp)
      const entryDateOnly = entry.entry_date?.split('T')[0] || entry.entry_date
      
      if (entriesStartDate && entryDateOnly < entriesStartDate) {
        filteredCount.startDate++
        console.log('❌ Filtered out (before start):', {
          entryDateOnly,
          entriesStartDate,
          comparison: `${entryDateOnly} < ${entriesStartDate}`,
          result: entryDateOnly < entriesStartDate
        })
        return false
      }
      if (entriesEndDate && entryDateOnly > entriesEndDate) {
        filteredCount.endDate++
        console.log('❌ Filtered out (after end):', {
          entryDateOnly,
          entriesEndDate,
          comparison: `${entryDateOnly} > ${entriesEndDate}`,
          result: entryDateOnly > entriesEndDate
        })
        return false
      }
      
      // Log entries that PASS the date filter
      if (entriesStartDate || entriesEndDate) {
        console.log('✅ Entry PASSED date filter:', {
          entryDateOnly,
          entriesStartDate,
          entriesEndDate
        })
      }
      
      filteredCount.passed++
      return true
    })
    
    // Log filter summary
    console.log('📊 FILTER SUMMARY:', {
      totalEntries: timeEntries.length,
      filteredOutBy: {
        employee: filteredCount.employee,
        project: filteredCount.project,
        phase: filteredCount.phase,
        startDate: filteredCount.startDate,
        endDate: filteredCount.endDate
      },
      passed: filteredCount.passed,
      resultCount: filtered.length,
      activeFilters: {
        employee: entriesEmployeeFilter !== 'all' ? entriesEmployeeFilter : 'none',
        project: entriesProjectFilter !== 'all' ? entriesProjectFilter : 'none',
        phase: entriesPhaseFilter !== 'all' ? entriesPhaseFilter : 'none',
        startDate: entriesStartDate || 'none',
        endDate: entriesEndDate || 'none'
      }
    })
    
    // Sort by date
    filtered.sort((a: any, b: any) => {
      const dateA = new Date(a.entry_date).getTime()
      const dateB = new Date(b.entry_date).getTime()
      return dateSortDirection === 'asc' ? dateA - dateB : dateB - dateA
    })
    
    // Debug logging for filter results
    if (entriesStartDate || entriesEndDate) {
      console.log('✅ Filter Results:', {
        totalFiltered: filtered.length,
        dateRange: filtered.length > 0 ? {
          earliest: filtered[filtered.length - 1]?.entry_date,
          latest: filtered[0]?.entry_date
        } : 'No entries'
      })
    }
    
    return filtered
  }, [timeEntries, entriesEmployeeFilter, entriesProjectFilter, entriesPhaseFilter, entriesStartDate, entriesEndDate, dateSortDirection])

  // Calculate total hours for filtered entries
  const totalFilteredHours = useMemo(() => {
    return filteredEntries.reduce((sum: number, entry: any) => sum + (parseFloat(entry.hours) || 0), 0)
  }, [filteredEntries])

  // Paginate entries
  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * entriesPerPage
    const endIndex = startIndex + entriesPerPage
    return filteredEntries.slice(startIndex, endIndex)
  }, [filteredEntries, currentPage, entriesPerPage])

  const totalPages = Math.ceil(filteredEntries.length / entriesPerPage)

  // Reset to page 1 when filters change
  const resetPage = () => setCurrentPage(1)
  
  // Auto-reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [entriesEmployeeFilter, entriesProjectFilter, entriesPhaseFilter, entriesStartDate, entriesEndDate])

  // Toggle date sort direction
  const toggleDateSort = () => {
    setDateSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  // Clear all filters
  const clearFilters = () => {
    setEntriesEmployeeFilter('all')
    setEntriesProjectFilter('all')
    setEntriesPhaseFilter('all')
    setEntriesStartDate('')
    setEntriesEndDate('')
    resetPage()
  }

  // Show skeleton while user loads
  if (!currentUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Time</h1>
        </div>
        <div className="p-8 text-center text-muted-foreground">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Time</h1>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="entries">Entries</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Dashboard-specific filters */}
          <div className="flex gap-3 justify-end">
            {userRole === 'admin' && (
              <Select value={dashboardEmployee || 'all'} onValueChange={(v) => setDashboardEmployee(v === 'all' ? null : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {(employees || []).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="year">Year</SelectItem>
                <SelectItem value="quarter">Quarter</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Utilization Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Utilization</CardTitle>
              <CardDescription>
                Percentage of hours billed to projects vs. overhead
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUtilization ? (
                <Skeleton className="h-[300px] w-full" />
              ) : utilizationData && utilizationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={utilizationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="periodLabel" />
                    <YAxis 
                      tickFormatter={(value) => `${value}%`}
                      domain={[0, 100]}
                    />
                    <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" strokeWidth={2} label={{ value: '80% Target', position: 'right', fill: '#059669' }} />
                    <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '70% Warning', position: 'right', fill: '#d97706' }} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                              <p className="font-semibold mb-2">{data.periodLabel}</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600">Utilization:</span>
                                  <span className="font-medium">{data.utilizationRate}%</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600">Project Hours:</span>
                                  <span className="font-medium">{data.projectHours.toFixed(1)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600">Total Hours:</span>
                                  <span className="font-medium">{data.totalHours.toFixed(1)}</span>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Line type="monotone" dataKey="utilizationRate" stroke="#384eaa" strokeWidth={2} dot={{ r: 4 }} name="Utilization %" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No utilization data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* PTO Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>PTO Usage</CardTitle>
              <CardDescription>
                Hours of PTO, vacation, and sick time used
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPto ? (
                <Skeleton className="h-[300px] w-full" />
              ) : ptoData && ptoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={ptoData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="periodLabel" />
                    <YAxis 
                      tickFormatter={(value) => `${value}h`}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                              <p className="font-semibold mb-2">{data.periodLabel}</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600">Total PTO:</span>
                                  <span className="font-medium">{data.totalHours.toFixed(1)}h</span>
                                </div>
                                {data.byType && (
                                  <>
                                    {data.byType.PTO > 0 && (
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-600">PTO:</span>
                                        <span className="font-medium">{data.byType.PTO.toFixed(1)}h</span>
                                      </div>
                                    )}
                                    {data.byType.Vacation > 0 && (
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-600">Vacation:</span>
                                        <span className="font-medium">{data.byType.Vacation.toFixed(1)}h</span>
                                      </div>
                                    )}
                                    {data.byType.Sick > 0 && (
                                      <div className="flex justify-between gap-4">
                                        <span className="text-gray-600">Sick:</span>
                                        <span className="font-medium">{data.byType.Sick.toFixed(1)}h</span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="totalHours" fill="#0891b2" radius={[4, 4, 0, 0]} name="PTO Hours" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No PTO usage available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entries Tab */}
        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <CardTitle>Time Entries</CardTitle>
              <CardDescription>
                Browse and filter time entries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filter Controls - Inside Entries Tab */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg border">
                {/* Date Range */}
                <div className="space-y-1">
                  <Label htmlFor="start-date" className="text-xs font-medium">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={entriesStartDate}
                    onChange={(e) => {
                      console.log('📅 START DATE CHANGED:', {
                        value: e.target.value,
                        type: typeof e.target.value,
                        length: e.target.value?.length
                      })
                      setEntriesStartDate(e.target.value)
                    }}
                    className="h-9"
                    suppressHydrationWarning
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end-date" className="text-xs font-medium">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={entriesEndDate}
                    onChange={(e) => {
                      console.log('📅 END DATE CHANGED:', {
                        value: e.target.value,
                        type: typeof e.target.value,
                        length: e.target.value?.length
                      })
                      setEntriesEndDate(e.target.value)
                    }}
                    className="h-9"
                    suppressHydrationWarning
                  />
                </div>

                {/* Employee Filter */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Employee</Label>
                  <Select value={entriesEmployeeFilter} onValueChange={setEntriesEmployeeFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {(employees || []).map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Project Filter */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Project</Label>
                  <Select value={entriesProjectFilter} onValueChange={setEntriesProjectFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {uniqueProjects.map((project: string) => (
                        <SelectItem key={project} value={project}>
                          {project}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Phase Filter */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Phase</Label>
                  <Select value={entriesPhaseFilter} onValueChange={setEntriesPhaseFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Phases" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Phases</SelectItem>
                      {uniquePhases.map((phase: string) => (
                        <SelectItem key={phase} value={phase}>
                          {phase}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters Button */}
                <div className="space-y-1 flex items-end">
                  <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 w-full">
                    Clear Filters
                  </Button>
                </div>
              </div>

              {/* Filter Summary */}
              <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                <span>
                  Showing {filteredEntries.length} of {timeEntries?.length || 0} entries
                </span>
                <span className="font-semibold text-foreground">
                  Total: {totalFilteredHours.toFixed(1)} hours
                </span>
              </div>

              {loadingEntries ? (
                <Skeleton className="h-[400px] w-full" />
              ) : (
                <div className="overflow-auto max-h-[600px] border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="border-b sticky top-0 bg-white">
                      <tr className="text-left">
                        <th className="p-2 font-semibold">
                          <button
                            onClick={toggleDateSort}
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                          >
                            Date
                            {dateSortDirection === 'asc' ? (
                              <ArrowUp className="h-4 w-4" />
                            ) : dateSortDirection === 'desc' ? (
                              <ArrowDown className="h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="p-2 font-semibold">Employee</th>
                        <th className="p-2 font-semibold">Project</th>
                        <th className="p-2 font-semibold">Phase</th>
                        <th className="p-2 font-semibold text-right">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.length > 0 ? (
                        <>
                          {paginatedEntries.map((entry: any) => (
                            <tr key={entry.id} className="border-b hover:bg-gray-50">
                              <td className="p-2">{new Date(entry.entry_date).toLocaleDateString('en-US')}</td>
                              <td className="p-2">{entry.employee_name}</td>
                              <td className="p-2">{entry.project_number}</td>
                              <td className="p-2">{entry.phase_name}</td>
                              <td className="p-2 text-right">{entry.hours}</td>
                            </tr>
                          ))}
                          {/* Total Row */}
                          <tr className="bg-gray-100 font-semibold sticky bottom-0">
                            <td className="p-2" colSpan={4}>Total</td>
                            <td className="p-2 text-right">{totalFilteredHours.toFixed(1)}</td>
                          </tr>
                        </>
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            No time entries found matching filters
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {filteredEntries.length > 0 && (
                <div className="flex items-center justify-between px-2 py-4 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page:</span>
                    <Select value={entriesPerPage.toString()} onValueChange={(v) => {
                      setEntriesPerPage(Number(v))
                      setCurrentPage(1)
                    }}>
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>

                    <div className="flex items-center gap-1">
                      {/* Previous Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p - 1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        ←
                      </Button>

                      {/* Page Number Buttons */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          // Show current page ± 2 pages
                          return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2
                        })
                        .map((page, idx, arr) => {
                          // Add ellipsis if there's a gap
                          const prevPage = arr[idx - 1]
                          const showEllipsis = prevPage && page - prevPage > 1
                          
                          return (
                            <div key={page} className="flex items-center gap-1">
                              {showEllipsis && (
                                <span className="px-2 text-muted-foreground">...</span>
                              )}
                              <Button
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                className="h-8 w-8 p-0"
                              >
                                {page}
                              </Button>
                            </div>
                          )
                        })}

                      {/* Next Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        →
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
