'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Check, Send, Copy } from 'lucide-react'
import { useTimesheetMutations } from '../hooks/useTimesheetMutations'

interface TimesheetActionsProps {
  weekStatus: 'empty' | 'draft' | 'submitted' | 'approved'
  weekEndingDate: string
  employeeId: string
  userRole: 'admin' | 'project_manager' | 'employee'
  onActionComplete: () => void
}

export function TimesheetActions({
  weekStatus,
  weekEndingDate,
  employeeId,
  userRole,
  onActionComplete
}: TimesheetActionsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [showConfirm, setShowConfirm] = useState<'submit' | 'approve' | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const { copyFromLastWeek, isCopying } = useTimesheetMutations()

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/timesheets/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekEndingDate })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onActionComplete()
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to submit'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
      setShowConfirm(null)
    }
  }

  const handleApprove = async () => {
    setIsApproving(true)
    setError(null)
    try {
      const res = await fetch('/api/timesheets/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, weekEndingDate })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onActionComplete()
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to approve'
      setError(errorMessage)
    } finally {
      setIsApproving(false)
      setShowConfirm(null)
    }
  }

  const handleCopyFromLastWeek = async () => {
    setError(null)
    try {
      await copyFromLastWeek(weekEndingDate)
      onActionComplete()
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to copy'
      setError(errorMessage)
    }
  }

  const isEditable = weekStatus !== 'approved'

  return (
    <div className="flex items-center justify-between py-4 border-t">
      <div className="flex items-center gap-2">
        {error && <p className="text-sm text-red-500">{error}</p>}
        
        {/* Copy from Last Week - show for editable weeks */}
        {isEditable && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyFromLastWeek}
            disabled={isCopying}
          >
            <Copy className="w-4 h-4 mr-2" />
            {isCopying ? 'Copying...' : 'Copy from Last Week'}
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        {/* Submit Button - Show for draft status */}
        {weekStatus === 'draft' && (
          <Button
            onClick={() => setShowConfirm('submit')}
            disabled={isSubmitting}
          >
            <Send className="w-4 h-4 mr-2" />
            Submit Week
          </Button>
        )}

        {/* Approve Button - Admin only, show for submitted status */}
        {userRole === 'admin' && weekStatus === 'submitted' && (
          <Button
            onClick={() => setShowConfirm('approve')}
            disabled={isApproving}
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Approve Week
          </Button>
        )}
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirm !== null} onOpenChange={() => setShowConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showConfirm === 'submit' ? 'Submit Timesheet?' : 'Approve Timesheet?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {showConfirm === 'submit' 
                ? 'This will submit your timesheet for approval. You can still edit entries until they are approved.'
                : 'This will approve all entries for this week. Approved entries cannot be edited.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={showConfirm === 'submit' ? handleSubmit : handleApprove}
            >
              {showConfirm === 'submit' ? 'Submit' : 'Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
