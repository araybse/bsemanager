'use client'

import { useState } from 'react'
import { useTimesheetMutations } from '../hooks/useTimesheetMutations'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Trash2 } from 'lucide-react'

interface DescriptionEditorProps {
  entryId: number | null
  projectNumber: string
  phaseName: string
  projectId: number
  date: string
  initialHours: number
  initialNotes: string
  onClose: () => void
  onSave: () => void
  employeeId?: string // Optional - for admin editing other users' timesheets
}

export function DescriptionEditor({
  entryId,
  projectNumber,
  phaseName,
  projectId,
  date,
  initialHours,
  initialNotes,
  onClose,
  onSave,
  employeeId
}: DescriptionEditorProps) {
  const [hours, setHours] = useState(initialHours.toString())
  const [notes, setNotes] = useState(initialNotes)
  const [error, setError] = useState<string | null>(null)

  const { saveEntry, deleteEntry, isSaving, isDeleting } = useTimesheetMutations()

  const handleSave = async () => {
    setError(null)

    // Validation: notes required if hours > 0
    const hoursNum = parseFloat(hours) || 0
    if (hoursNum > 0 && (!notes || notes.trim().length === 0)) {
      setError('Work description is required')
      return
    }

    try {
      await saveEntry({
        id: entryId,
        project_id: projectId,
        project_number: projectNumber,
        phase_name: phaseName,
        entry_date: date,
        hours: hoursNum,
        notes: notes.trim(),
        ...(employeeId ? { employee_id: employeeId } : {})
      })
      onSave()
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to save'
      setError(errorMessage)
    }
  }

  const handleDelete = async () => {
    if (!entryId) return
    if (!confirm('Delete this time entry?')) return

    try {
      await deleteEntry(entryId)
      onSave()
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to delete'
      setError(errorMessage)
    }
  }

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>
            {entryId ? 'Edit Time Entry' : 'Add Time Entry'}
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            {projectNumber} • {phaseName}
          </div>
          <div className="text-sm font-medium">
            {formattedDate}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Hours</Label>
            <Input
              id="hours"
              type="number"
              step="0.25"
              min="0"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-32"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">
              Work Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the work performed..."
              rows={6}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>

        <SheetFooter className="flex justify-between">
          <div>
            {entryId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
