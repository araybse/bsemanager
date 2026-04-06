'use client'

import { useState } from 'react'
import { useTimesheet } from '../hooks/useTimesheet'
import { useWeekNavigation } from '../hooks/useWeekNavigation'
import { useTimesheetMutations } from '../hooks/useTimesheetMutations'
import { WeekNavigator } from './WeekNavigator'
import { WeeklyCalendarGrid } from './WeeklyCalendarGrid'
import { DescriptionEditor } from './DescriptionEditor'
import { ProjectPhaseSelector } from './ProjectPhaseSelector'
import { TimesheetActions } from './TimesheetActions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TimesheetTabProps {
  currentUserId: string
  userRole: 'admin' | 'project_manager' | 'employee'
  employees?: Array<{ id: string; full_name: string }>
}

interface SelectedCell {
  entryId: number | null
  projectNumber: string
  phaseName: string
  projectId: number
  date: string
  hours: number
  notes: string
}

export function TimesheetTab({ currentUserId, userRole, employees }: TimesheetTabProps) {
  const { currentWeek, goToPreviousWeek, goToNextWeek, goToCurrentWeek, isCurrentWeek } = useWeekNavigation()
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [viewingEmployeeId, setViewingEmployeeId] = useState<string>(currentUserId)
  
  const { saveEntry } = useTimesheetMutations()

  // Determine which employee's data to view
  const effectiveEmployeeId = userRole === 'admin' ? viewingEmployeeId : currentUserId

  const { 
    data: timesheet, 
    isLoading, 
    error,
    refetch 
  } = useTimesheet(currentWeek.weekEndingDate, effectiveEmployeeId)

  const handleCellClick = (cell: SelectedCell) => {
    if (timesheet?.weekStatus === 'approved') return // Can't edit approved weeks
    setSelectedCell(cell)
  }

  const handleEditorClose = () => {
    setSelectedCell(null)
  }

  const handleEditorSave = () => {
    setSelectedCell(null)
    refetch()
  }

  const handleAddProject = async (
    project: { id: number; number: string; name: string },
    phase: string
  ) => {
    // Create a placeholder entry with 0 hours for the first weekday (Monday)
    const mondayDate = new Date(currentWeek.weekStartDate + 'T00:00:00')
    mondayDate.setDate(mondayDate.getDate() + 1) // Sunday + 1 = Monday
    
    try {
      await saveEntry({
        id: null,
        project_id: project.id,
        project_number: project.number,
        phase_name: phase,
        entry_date: mondayDate.toISOString().split('T')[0],
        hours: 0,
        notes: '',
        ...(effectiveEmployeeId !== currentUserId ? { employee_id: effectiveEmployeeId } : {})
      })
      refetch()
    } catch (e) {
      console.error('Failed to add project row:', e)
    }
  }

  const isEditable = timesheet?.weekStatus !== 'approved' && (effectiveEmployeeId === currentUserId || userRole === 'admin')
  const isViewingOthers = effectiveEmployeeId !== currentUserId && userRole !== 'admin'

  return (
    <div className="space-y-4">
      {/* Top Controls Row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Week Navigation */}
        <WeekNavigator
          weekStart={currentWeek.weekStartDate}
          weekEnd={currentWeek.weekEndingDate}
          onPrevious={goToPreviousWeek}
          onNext={goToNextWeek}
          onToday={goToCurrentWeek}
          isCurrentWeek={isCurrentWeek}
        />
        
        <div className="flex items-center gap-4">
          {/* Employee Selector (Admin only) */}
          {userRole === 'admin' && employees && employees.length > 0 && (
            <Select value={viewingEmployeeId} onValueChange={setViewingEmployeeId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {/* Status Badge */}
          <Badge variant={
            timesheet?.weekStatus === 'approved' ? 'default' :
            timesheet?.weekStatus === 'submitted' ? 'secondary' :
            'outline'
          }>
            {timesheet?.weekStatus === 'approved' && '✓ Approved'}
            {timesheet?.weekStatus === 'submitted' && '⏳ Submitted'}
            {timesheet?.weekStatus === 'draft' && '📝 Draft'}
            {timesheet?.weekStatus === 'empty' && 'No Entries'}
          </Badge>
          
          {/* Total Hours */}
          {timesheet?.totals && (
            <span className="text-lg font-semibold">
              {timesheet.totals.total.toFixed(1)} hrs
            </span>
          )}
        </div>
      </div>

      {/* Viewing Others Notice */}
      {isViewingOthers && (
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-md text-sm">
          Viewing timesheet for another employee
        </div>
      )}

      {/* Main Grid Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Weekly Timesheet</CardTitle>
            {isEditable && (
              <ProjectPhaseSelector onAdd={handleAddProject} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : error ? (
            <div className="text-red-500 p-4">
              Error loading timesheet: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : (
            <WeeklyCalendarGrid
              gridData={timesheet?.gridData || []}
              totals={timesheet?.totals || { 
                byDay: { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 }, 
                total: 0 
              }}
              weekStartDate={currentWeek.weekStartDate}
              onCellClick={handleCellClick}
              isEditable={isEditable}
              employeeId={effectiveEmployeeId}
            />
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {timesheet && !isViewingOthers && (
        <TimesheetActions
          weekStatus={timesheet.weekStatus}
          weekEndingDate={currentWeek.weekEndingDate}
          employeeId={effectiveEmployeeId}
          userRole={userRole}
          onActionComplete={refetch}
        />
      )}

      {/* Admin Approve Button when viewing others' timesheets */}
      {timesheet && effectiveEmployeeId !== currentUserId && userRole === 'admin' && timesheet.weekStatus === 'submitted' && (
        <TimesheetActions
          weekStatus={timesheet.weekStatus}
          weekEndingDate={currentWeek.weekEndingDate}
          employeeId={effectiveEmployeeId}
          userRole={userRole}
          onActionComplete={refetch}
        />
      )}

      {/* Description Editor Sidebar */}
      {selectedCell && (
        <DescriptionEditor
          entryId={selectedCell.entryId}
          projectNumber={selectedCell.projectNumber}
          phaseName={selectedCell.phaseName}
          projectId={selectedCell.projectId}
          date={selectedCell.date}
          initialHours={selectedCell.hours}
          initialNotes={selectedCell.notes}
          onClose={handleEditorClose}
          onSave={handleEditorSave}
          employeeId={effectiveEmployeeId}
        />
      )}
    </div>
  )
}
