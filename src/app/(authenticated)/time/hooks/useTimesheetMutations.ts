import { useMutation, useQueryClient } from '@tanstack/react-query'

interface SaveEntryParams {
  id: number | null
  project_id: number
  project_number: string
  phase_name: string
  entry_date: string
  hours: number
  notes: string
  employee_id?: string // Optional - for admin creating entries for other users
}

export function useTimesheetMutations() {
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async (entry: SaveEntryParams) => {
      const res = await fetch('/api/timesheets/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save entry')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const res = await fetch('/api/timesheets/entry', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entryId })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete entry')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] })
    }
  })

  const copyWeekMutation = useMutation({
    mutationFn: async (targetWeekEndingDate: string) => {
      const res = await fetch('/api/timesheets/copy-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetWeekEndingDate })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to copy from previous week')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] })
    }
  })

  return {
    saveEntry: saveMutation.mutateAsync,
    deleteEntry: deleteMutation.mutateAsync,
    copyFromLastWeek: copyWeekMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCopying: copyWeekMutation.isPending
  }
}
