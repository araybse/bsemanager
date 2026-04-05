'use client'

import { useState } from 'react'
import { TimeEntryCell } from './TimeEntryCell'
import { DAYS, formatShortDate } from '@/lib/timesheet/week-utils'
import type { TimesheetGridRow, TimesheetTotals } from '../hooks/useTimesheet'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

interface CellClickData {
  entryId: number | null
  projectNumber: string
  phaseName: string
  projectId: number
  date: string
  hours: number
  notes: string
}

interface WeeklyCalendarGridProps {
  gridData: TimesheetGridRow[]
  totals: TimesheetTotals
  weekStartDate: string
  onCellClick: (cell: CellClickData) => void
  isEditable: boolean
  employeeId?: string
}

export function WeeklyCalendarGrid({
  gridData,
  totals,
  weekStartDate,
  onCellClick,
  isEditable,
  employeeId
}: WeeklyCalendarGridProps) {
  const queryClient = useQueryClient()
  const [deletingRow, setDeletingRow] = useState<string | null>(null)

  const handleDeleteRow = async (projectNumber: string, phaseName: string) => {
    const rowKey = `${projectNumber}-${phaseName}`
    if (!confirm(`Delete all draft entries for ${projectNumber} - ${phaseName}?`)) return
    
    setDeletingRow(rowKey)
    
    try {
      // Find all draft entries for this project/phase in this week
      const row = gridData.find(r => r.project_number === projectNumber && r.phase_name === phaseName)
      if (!row) return
      
      const entryIds = Object.values(row.days)
        .filter((entry): entry is NonNullable<typeof entry> => 
          entry !== null && entry.status === 'draft'
        )
        .map(entry => entry.id)
      
      // Delete each entry
      for (const id of entryIds) {
        const response = await fetch('/api/timesheets/entry', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        })
        
        if (!response.ok) {
          throw new Error('Failed to delete entry')
        }
      }
      
      // Refresh timesheet data
      await queryClient.invalidateQueries({ queryKey: ['timesheet'] })
    } catch (error) {
      console.error('Failed to delete row:', error)
      alert('Failed to delete entries. Please try again.')
    } finally {
      setDeletingRow(null)
    }
  }
  // Calculate dates for each day
  const startDate = new Date(weekStartDate + 'T00:00:00')
  const dayDates = DAYS.map((_, i) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    return date.toISOString().split('T')[0]
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-2 text-left font-medium w-48">Project</th>
            <th className="p-2 text-left font-medium w-32">Phase</th>
            {DAYS.map((day, i) => (
              <th key={day} className="p-2 text-center font-medium w-20">
                <div>{day}</div>
                <div className="text-xs text-muted-foreground">
                  {formatShortDate(dayDates[i])}
                </div>
              </th>
            ))}
            <th className="p-2 text-right font-medium w-16">Total</th>
            {isEditable && <th className="p-2 w-12"></th>}
          </tr>
        </thead>
        <tbody>
          {gridData.length === 0 ? (
            <tr>
              <td colSpan={10} className="p-8 text-center text-muted-foreground">
                No time entries for this week. Use &quot;Add Project&quot; to start tracking time.
              </td>
            </tr>
          ) : (
            gridData.map((row) => {
              const rowKey = `${row.project_number}-${row.phase_name}`
              const hasOnlyDraftEntries = Object.values(row.days).every(
                entry => entry === null || entry.status === 'draft'
              )
              const isDeleting = deletingRow === rowKey
              
              return (
                <tr key={rowKey} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-medium">
                    <div className="truncate" title={row.project_name || row.project_number}>
                      {row.project_number}
                    </div>
                    {row.project_name && (
                      <div className="text-xs text-muted-foreground truncate">
                        {row.project_name}
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {row.phase_name}
                  </td>
                  {DAYS.map((day, dayIndex) => {
                    const entry = row.days[day]
                    return (
                      <td key={day} className="p-1">
                        <TimeEntryCell
                          entry={entry}
                          date={dayDates[dayIndex]}
                          projectNumber={row.project_number}
                          phaseName={row.phase_name}
                          projectId={row.project_id}
                          onClick={onCellClick}
                          isEditable={isEditable}
                        />
                      </td>
                    )
                  })}
                  <td className="p-2 text-right font-semibold">
                    {row.total.toFixed(1)}
                  </td>
                  {isEditable && (
                    <td className="p-1">
                      {hasOnlyDraftEntries && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRow(row.project_number, row.phase_name)}
                          disabled={isDeleting}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete all draft entries for this project/phase"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
        {/* Totals Footer */}
        <tfoot>
          <tr className="bg-muted/80 font-semibold">
            <td className="p-2" colSpan={2}>Daily Totals</td>
            {DAYS.map(day => (
              <td key={day} className="p-2 text-center">
                {(totals.byDay[day] || 0).toFixed(1)}
              </td>
            ))}
            <td className="p-2 text-right text-lg">
              {totals.total.toFixed(1)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
