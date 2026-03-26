'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Save, Trash2 } from 'lucide-react'

type TimeEntry = {
  id: number
  project_id: number | null
  project_number: string
  phase_name: string
  entry_date: string
  hours: number
  notes: string | null
  employee_id: string
}

type WeekRow = {
  rowId: string
  projectNumber: string
  projectId: number | null
  phaseName: string
  days: Record<string, { hours: string; notes: string; entryId: number | null }>
}

export default function TimesheetPage() {
  const supabase = createClient()
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null)
  
  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', user.id)
        .single()
      return profile
    },
  })

  const isAdmin = currentUser?.role === 'admin'
  
  // Week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  // Selected employee
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')

  const effectiveEmployeeId = isAdmin ? selectedEmployeeId : (currentUser?.id || '')

  // Fetch employees (for admin dropdown)
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name')
      return data || []
    },
  })

  // Set default employee
  useEffect(() => {
    if (isAdmin && employees && employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id)
    }
  }, [isAdmin, employees, selectedEmployeeId])

  useEffect(() => {
    if (!isAdmin && currentUser) {
      setSelectedEmployeeId(currentUser.id)
    }
  }, [isAdmin, currentUser])

  // Calculate week dates
  const weekDates = useMemo(() => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(currentWeekStart.getDate() + i)
      dates.push(date)
    }
    return dates
  }, [currentWeekStart])

  const weekEndDate = useMemo(() => {
    const end = new Date(currentWeekStart)
    end.setDate(currentWeekStart.getDate() + 6)
    return end
  }, [currentWeekStart])

  const formatWeekRange = () => {
    const start = currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const end = weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} - ${end}`
  }

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() - 7)
    setCurrentWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() + 7)
    setCurrentWeekStart(newStart)
  }

  if (!currentUser) {
    return <div className="p-6">Loading...</div>
  }

  const selectedEmployee = employees?.find(e => e.id === effectiveEmployeeId)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Timesheet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedEmployee?.full_name || currentUser.full_name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isAdmin && employees && (
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base font-medium min-w-[220px] text-center">
                  Week of {formatWeekRange()}
                </CardTitle>
                <Button variant="outline" size="icon" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Building timesheet table...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
