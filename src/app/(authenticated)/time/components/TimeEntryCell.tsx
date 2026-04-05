'use client'

import { cn } from '@/lib/utils'

interface TimeEntryCellProps {
  entry: { id: number; hours: number; notes: string; status: string } | null
  date: string
  projectNumber: string
  phaseName: string
  projectId: number
  onClick: (cell: {
    entryId: number | null
    projectNumber: string
    phaseName: string
    projectId: number
    date: string
    hours: number
    notes: string
  }) => void
  isEditable: boolean
}

export function TimeEntryCell({
  entry,
  date,
  projectNumber,
  phaseName,
  projectId,
  onClick,
  isEditable
}: TimeEntryCellProps) {
  const handleClick = () => {
    if (!isEditable) return
    
    onClick({
      entryId: entry?.id || null,
      projectNumber,
      phaseName,
      projectId,
      date,
      hours: entry?.hours || 0,
      notes: entry?.notes || ''
    })
  }

  const hasNotes = entry?.notes && entry.notes.trim().length > 0
  const hours = entry?.hours || 0

  return (
    <button
      onClick={handleClick}
      disabled={!isEditable}
      className={cn(
        'w-full h-12 rounded border transition-colors text-center',
        'flex flex-col items-center justify-center gap-0.5',
        isEditable && 'hover:bg-blue-50 hover:border-blue-300 cursor-pointer',
        !isEditable && 'cursor-not-allowed opacity-75',
        entry ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200',
        !hasNotes && hours > 0 && 'ring-2 ring-yellow-400' // Missing description warning
      )}
      title={hasNotes ? entry.notes : (hours > 0 ? '⚠️ Missing description' : 'Click to add time')}
    >
      {hours > 0 ? (
        <>
          <span className="font-semibold text-sm">{hours.toFixed(1)}</span>
          {!hasNotes && <span className="text-[10px] text-yellow-600">⚠️</span>}
        </>
      ) : (
        <span className="text-gray-400 text-xs">—</span>
      )}
    </button>
  )
}
