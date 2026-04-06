'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2 } from 'lucide-react'

interface TimeEntry {
  id: number
  employee_id: string
  employee_name: string
  entry_date: string
  project_number: string
  phase_name: string
  hours: number
  notes: string
  status: string
  project_id: number
}

interface ApprovalsTabProps {
  employees: Array<{ id: string; full_name: string }> | undefined
}

export function ApprovalsTab({ employees }: ApprovalsTabProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth)
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set())
  const [editingEntry, setEditingEntry] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<{
    project_number?: string
    phase_name?: string
    hours?: number
    notes?: string
  }>({})
  const [dateSortDirection, setDateSortDirection] = useState<'asc' | 'desc'>('asc')

  // Fetch submitted entries
  const { data: entries, isLoading } = useQuery({
    queryKey: ['approval-entries', selectedEmployee, selectedMonth, selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().slice(0, 10)
      
      let query = supabase
        .from('time_entries')
        .select('id, employee_id, employee_name, entry_date, project_number, phase_name, hours, notes, status, project_id')
        .in('status', ['submitted', 'approved'])
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .order('entry_date', { ascending: true })
      
      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data as TimeEntry[]
    },
  })

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (entryIds: number[]) => {
      const { error } = await (supabase as any)
        .from('time_entries')
        .update({ status: 'approved' })
        .in('id', entryIds)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-entries'] })
      setSelectedEntries(new Set())
    },
  })

  // Unapprove mutation
  const unapproveMutation = useMutation({
    mutationFn: async (entryIds: number[]) => {
      const { error } = await (supabase as any)
        .from('time_entries')
        .update({ status: 'submitted' })
        .in('id', entryIds)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-entries'] })
      setSelectedEntries(new Set())
    },
  })

  // Update entry mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<TimeEntry> }) => {
      const { error } = await (supabase as any)
        .from('time_entries')
        .update(updates)
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-entries'] })
      setEditingEntry(null)
      setEditValues({})
    },
  })

  const submittedEntries = useMemo(() => {
    return entries?.filter(e => e.status === 'submitted') || []
  }, [entries])

  const approvedEntries = useMemo(() => {
    return entries?.filter(e => e.status === 'approved') || []
  }, [entries])

  // Sort entries by date
  const sortedEntries = useMemo(() => {
    if (!entries) return []
    return [...entries].sort((a, b) => {
      const dateA = new Date(a.entry_date).getTime()
      const dateB = new Date(b.entry_date).getTime()
      return dateSortDirection === 'asc' ? dateA - dateB : dateB - dateA
    })
  }, [entries, dateSortDirection])

  const sortedSubmittedEntries = useMemo(() => {
    return sortedEntries.filter(e => e.status === 'submitted')
  }, [sortedEntries])

  const sortedApprovedEntries = useMemo(() => {
    return sortedEntries.filter(e => e.status === 'approved')
  }, [sortedEntries])

  const handleToggleEntry = (id: number) => {
    const newSet = new Set(selectedEntries)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedEntries(newSet)
  }

  const handleSelectAll = () => {
    if (selectedEntries.size === sortedEntries.length) {
      setSelectedEntries(new Set())
    } else {
      setSelectedEntries(new Set(sortedEntries.map(e => e.id)))
    }
  }

  const toggleDateSort = () => {
    setDateSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  const handleApproveAll = () => {
    if (submittedEntries.length > 0) {
      approveMutation.mutate(submittedEntries.map(e => e.id))
    }
  }

  const handleApproveSelected = () => {
    if (selectedEntries.size > 0) {
      const selectedIds = Array.from(selectedEntries)
      const selectedSubmitted = sortedEntries.filter(e => selectedIds.includes(e.id) && e.status === 'submitted')
      if (selectedSubmitted.length > 0) {
        approveMutation.mutate(selectedSubmitted.map(e => e.id))
      }
    }
  }

  const handleUnapproveSelected = () => {
    if (selectedEntries.size > 0) {
      const selectedIds = Array.from(selectedEntries)
      const selectedApproved = sortedEntries.filter(e => selectedIds.includes(e.id) && e.status === 'approved')
      if (selectedApproved.length > 0) {
        unapproveMutation.mutate(selectedApproved.map(e => e.id))
      }
    }
  }

  const handleStartEdit = (entry: TimeEntry) => {
    setEditingEntry(entry.id)
    setEditValues({
      project_number: entry.project_number,
      phase_name: entry.phase_name,
      hours: entry.hours,
      notes: entry.notes,
    })
  }

  const handleSaveEdit = (id: number) => {
    updateMutation.mutate({ id, updates: editValues })
  }

  const handleCancelEdit = () => {
    setEditingEntry(null)
    setEditValues({})
  }

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ]

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex items-center gap-4">
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees?.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value.toString()}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button 
          onClick={handleApproveSelected} 
          disabled={selectedEntries.size === 0 || approveMutation.isPending}
          variant="default"
        >
          Mark As Approved
        </Button>

        <Button 
          onClick={handleUnapproveSelected} 
          disabled={selectedEntries.size === 0 || unapproveMutation.isPending}
          variant="outline"
        >
          Mark As Unapproved
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-[400px] w-full" />
      ) : (
        <div className="border rounded-lg overflow-auto h-[600px]">
          <table className="w-full text-sm">
            <thead className="border-b sticky top-0 bg-white">
              <tr className="text-left">
                <th className="p-2 w-10">
                  <Checkbox
                    checked={selectedEntries.size === sortedEntries.length && sortedEntries.length > 0}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="p-2">
                  <button
                    onClick={toggleDateSort}
                    className="flex items-center gap-1 hover:text-primary transition-colors font-semibold"
                  >
                    Date
                    {dateSortDirection === 'asc' ? '↑' : '↓'}
                  </button>
                </th>
                <th className="p-2">Employee</th>
                <th className="p-2">Project</th>
                <th className="p-2">Phase</th>
                <th className="p-2 text-right">Hours</th>
                <th className="p-2">Work Description</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Submitted Entries (Editable) */}
              {sortedSubmittedEntries.map((entry) => {
                const isEditing = editingEntry === entry.id
                return (
                  <tr key={entry.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <Checkbox
                        checked={selectedEntries.has(entry.id)}
                        onCheckedChange={() => handleToggleEntry(entry.id)}
                      />
                    </td>
                    <td className="p-2">{new Date(entry.entry_date).toLocaleDateString('en-US')}</td>
                    <td className="p-2">{entry.employee_name}</td>
                    <td className="p-2">
                      {isEditing ? (
                        <Input
                          value={editValues.project_number || ''}
                          onChange={(e) => setEditValues({ ...editValues, project_number: e.target.value })}
                          className="h-8"
                        />
                      ) : (
                        <span onDoubleClick={() => handleStartEdit(entry)} className="cursor-pointer">
                          {entry.project_number}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <Input
                          value={editValues.phase_name || ''}
                          onChange={(e) => setEditValues({ ...editValues, phase_name: e.target.value })}
                          className="h-8"
                        />
                      ) : (
                        <span onDoubleClick={() => handleStartEdit(entry)} className="cursor-pointer">
                          {entry.phase_name}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.25"
                          value={editValues.hours || 0}
                          onChange={(e) => setEditValues({ ...editValues, hours: parseFloat(e.target.value) })}
                          className="h-8 w-20"
                        />
                      ) : (
                        <span onDoubleClick={() => handleStartEdit(entry)} className="cursor-pointer">
                          {entry.hours}
                        </span>
                      )}
                    </td>
                    <td className="p-2 max-w-xs">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={editValues.notes || ''}
                            onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                            className="h-8"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveEdit(entry.id)}>Save</Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <span
                          onDoubleClick={() => handleStartEdit(entry)}
                          className="cursor-pointer truncate block"
                          title={entry.notes}
                        >
                          {entry.notes}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      <Badge className="bg-amber-100 text-amber-800">Submitted</Badge>
                    </td>
                  </tr>
                )
              })}

              {/* Approved Entries (Selectable) */}
              {sortedApprovedEntries.map((entry) => (
                <tr key={entry.id} className="border-b bg-gray-50">
                  <td className="p-2">
                    <Checkbox 
                      checked={selectedEntries.has(entry.id)}
                      onCheckedChange={() => handleToggleEntry(entry.id)}
                    />
                  </td>
                  <td className="p-2">{new Date(entry.entry_date).toLocaleDateString('en-US')}</td>
                  <td className="p-2">{entry.employee_name}</td>
                  <td className="p-2">{entry.project_number}</td>
                  <td className="p-2">{entry.phase_name}</td>
                  <td className="p-2 text-right">{entry.hours}</td>
                  <td className="p-2 max-w-xs truncate" title={entry.notes}>{entry.notes}</td>
                  <td className="p-2">
                    <Badge className="bg-green-100 text-green-800">Approved</Badge>
                  </td>
                </tr>
              ))}

              {!entries || entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No entries found for this period
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
