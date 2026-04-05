'use client'

import { useState, useEffect } from 'react'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardHeader, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { toast } from 'sonner'

export interface PhaseForSelection {
  id: number
  phase_code: string
  phase_name: string
}

export interface PerformanceMultiplierCardProps {
  projectId: number
  phases: PhaseForSelection[]
}

export function PerformanceMultiplierCard({ projectId, phases }: PerformanceMultiplierCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedPhaseIds, setSelectedPhaseIds] = useState<number[]>([])
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['performance-multiplier', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/performance-multiplier`)
      if (!res.ok) throw new Error('Failed to fetch performance multiplier')
      return res.json() as Promise<{
        multiplier: number | null
        selectedPhaseIds: number[]
        totalRevenue: number
        totalLaborCost: number
      }>
    },
  })

  useEffect(() => {
    if (data?.selectedPhaseIds) {
      setSelectedPhaseIds(data.selectedPhaseIds)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async (phaseIds: number[]) => {
      const res = await fetch(`/api/projects/${projectId}/performance-multiplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPhaseIds: phaseIds }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save selections')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-multiplier', projectId] })
      setIsEditOpen(false)
      toast.success('Performance multiplier updated')
    },
    onError: (error: Error) => {
      console.error('Save error:', error)
      toast.error(error.message || 'Failed to update performance multiplier')
    },
  })

  const togglePhase = (phaseId: number) => {
    setSelectedPhaseIds((prev) =>
      prev.includes(phaseId) ? prev.filter((id) => id !== phaseId) : [...prev, phaseId]
    )
  }

  const handleSave = () => {
    saveMutation.mutate(selectedPhaseIds)
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardDescription>Performance Multiplier</CardDescription>
              <CardTitle className="text-xl group relative cursor-help">
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : data?.multiplier != null ? (
                  <>
                    {`${data.multiplier.toFixed(2)}x`}
                    <div className="invisible group-hover:visible absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64 z-10">
                      <div className="space-y-1 text-sm font-normal">
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-600">Selected Revenue:</span>
                          <span className="font-medium">{formatCurrency(data.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-600">Selected Cost:</span>
                          <span className="font-medium">{formatCurrency(data.totalLaborCost)}</span>
                        </div>
                        <div className="flex justify-between gap-4 pt-1 border-t">
                          <span className="font-semibold">Multiplier:</span>
                          <span className="font-semibold">{data.multiplier.toFixed(2)}x</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          {data.selectedPhaseIds.length}{' '}
                          {data.selectedPhaseIds.length === 1 ? 'phase' : 'phases'} selected
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  '—'
                )}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Performance Multiplier</DialogTitle>
            <DialogDescription>
              Select which phases to include in the performance calculation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {phases.map((phase) => (
              <div key={phase.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`phase-${phase.id}`}
                  checked={selectedPhaseIds.includes(phase.id)}
                  onCheckedChange={() => togglePhase(phase.id)}
                />
                <label
                  htmlFor={`phase-${phase.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                >
                  <span className="font-mono">{phase.phase_code}</span> - {phase.phase_name}
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
