'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { freshnessBadgeVariant, freshnessLabel, getFreshnessState } from '@/lib/ops/freshness'

type ChecksResponse = {
  checks: {
    phaseNameMismatches: {
      count: number
      top: Array<{
        line_item_id: number
        project_number: string
        project_name: string | null
        invoice_number: string
        phase_name: string
        amount: number
        suggested_phase_name: string | null
        available_phase_names: string[]
      }>
    }
    duplicateCostCandidates: {
      count: number
      top: Array<{
        project_number: string
        expense_date: string
        fee_amount: number
        description: string
        row_count: number
        source_types: string[]
      }>
    }
  }
}

type RunRow = {
  id: number
  trigger_mode: string
  triggered_by_email: string | null
  phase_mismatch_count: number
  duplicate_candidate_count: number
  created_at: string
}

export function DataQualityReviewSection() {
  const queryClient = useQueryClient()
  const [isRunning, setIsRunning] = useState(false)
  const [isApplyingLineItemId, setIsApplyingLineItemId] = useState<number | null>(null)
  const [phaseFixSelections, setPhaseFixSelections] = useState<Record<number, string>>({})

  const { data: checks, isLoading: loadingChecks } = useQuery({
    queryKey: ['data-quality-checks-full'],
    queryFn: async () => {
      const response = await fetch('/api/data-quality/checks')
      if (!response.ok) throw new Error('Failed to load checks')
      return (await response.json()) as ChecksResponse
    },
  })

  const { data: runs, isLoading: loadingRuns } = useQuery({
    queryKey: ['data-quality-runs'],
    queryFn: async () => {
      const response = await fetch('/api/data-quality/runs')
      if (!response.ok) throw new Error('Failed to load run history')
      const payload = (await response.json()) as { runs: RunRow[] }
      return payload.runs || []
    },
  })
  const latestRunAt = runs?.[0]?.created_at || null
  const runFreshness = getFreshnessState(latestRunAt, 24, 72)

  const runChecks = async () => {
    setIsRunning(true)
    try {
      const response = await fetch('/api/data-quality/run', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to run checks')
      } else {
        toast.success('Data quality checks completed')
        queryClient.invalidateQueries({ queryKey: ['data-quality-checks-full'] })
        queryClient.invalidateQueries({ queryKey: ['data-quality-checks'] })
        queryClient.invalidateQueries({ queryKey: ['data-quality-runs'] })
      }
    } catch {
      toast.error('Failed to run checks')
    } finally {
      setIsRunning(false)
    }
  }

  const applyAllSuggestedFixes = async () => {
    const rows = checks?.checks.phaseNameMismatches.top || []
    const fixes = rows
      .map((row) => ({
        line_item_id: row.line_item_id,
        new_phase_name:
          (phaseFixSelections[row.line_item_id] || row.suggested_phase_name || '').trim(),
      }))
      .filter((row) => row.new_phase_name.length > 0)

    if (!fixes.length) {
      toast.error('No suggested fixes available to apply')
      return
    }

    setIsRunning(true)
    try {
      const response = await fetch('/api/data-quality/fix-phase-mismatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixes }),
      })
      const payload = await response.json()
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to apply suggested fixes')
      } else {
        toast.success(`Applied fixes: ${payload?.summary?.updated || 0} updated`)
        queryClient.invalidateQueries({ queryKey: ['data-quality-checks-full'] })
        queryClient.invalidateQueries({ queryKey: ['data-quality-checks'] })
        queryClient.invalidateQueries({ queryKey: ['data-quality-runs'] })
      }
    } catch {
      toast.error('Failed to apply suggested fixes')
    } finally {
      setIsRunning(false)
    }
  }

  const applyPhaseFix = async (lineItemId: number) => {
    const selectedPhase = (phaseFixSelections[lineItemId] || '').trim()
    if (!selectedPhase) {
      toast.error('Choose a replacement phase first')
      return
    }

    setIsApplyingLineItemId(lineItemId)
    try {
      const response = await fetch('/api/data-quality/fix-phase-mismatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_item_id: lineItemId,
          new_phase_name: selectedPhase,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to apply phase fix')
      } else {
        toast.success('Phase mismatch fixed')
        queryClient.invalidateQueries({ queryKey: ['data-quality-checks-full'] })
        queryClient.invalidateQueries({ queryKey: ['data-quality-checks'] })
        queryClient.invalidateQueries({ queryKey: ['data-quality-runs'] })
      }
    } catch {
      toast.error('Failed to apply phase fix')
    } finally {
      setIsApplyingLineItemId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Data Quality Review</h2>
          <p className="text-sm text-muted-foreground">
            Validate phase mapping consistency and duplicate-cost risk.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={applyAllSuggestedFixes} disabled={isRunning}>
            Apply All Suggested Fixes
          </Button>
          <Button onClick={runChecks} disabled={isRunning}>
            {isRunning ? 'Running...' : 'Run Checks Now'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Phase Name Mismatches</CardTitle>
            <CardDescription>Invoice phase names missing from project contract phases</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingChecks ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{checks?.checks.phaseNameMismatches.count ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Duplicate Cost Candidates</CardTitle>
            <CardDescription>Potential overlap between reimbursable and labor-class costs</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingChecks ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {checks?.checks.duplicateCostCandidates.count ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Check Run Freshness</CardTitle>
            <CardDescription>Warns when automated checks are stale</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingRuns ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <Badge variant={freshnessBadgeVariant(runFreshness)}>
                  {freshnessLabel(runFreshness)}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  Last run: {latestRunAt ? new Date(latestRunAt).toLocaleString() : 'none'}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase Mismatch Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingChecks ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project #</TableHead>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Phase Name</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Fix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(checks?.checks.phaseNameMismatches.top || []).map((row, index) => (
                  <TableRow key={`${row.project_number}-${row.invoice_number}-${index}`}>
                    <TableCell className="font-mono">{row.project_number}</TableCell>
                    <TableCell>{row.project_name || '—'}</TableCell>
                    <TableCell className="font-mono">{row.invoice_number}</TableCell>
                    <TableCell>{row.phase_name}</TableCell>
                    <TableCell className="text-right font-mono">${row.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={phaseFixSelections[row.line_item_id] || row.suggested_phase_name || ''}
                          onValueChange={(value) =>
                            setPhaseFixSelections((prev) => ({
                              ...prev,
                              [row.line_item_id]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Choose replacement phase" />
                          </SelectTrigger>
                          <SelectContent>
                            {row.available_phase_names.map((phaseName) => (
                              <SelectItem key={phaseName} value={phaseName}>
                                {phaseName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {row.suggested_phase_name ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setPhaseFixSelections((prev) => ({
                                ...prev,
                                [row.line_item_id]: row.suggested_phase_name || '',
                              }))
                            }
                          >
                            Use Suggestion
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          onClick={() => applyPhaseFix(row.line_item_id)}
                          disabled={isApplyingLineItemId === row.line_item_id}
                        >
                          {isApplyingLineItemId === row.line_item_id ? 'Saving...' : 'Apply'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(checks?.checks.phaseNameMismatches.top || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No mismatches found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Duplicate Candidate Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingChecks ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Source Types</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(checks?.checks.duplicateCostCandidates.top || []).map((row, index) => (
                  <TableRow key={`${row.project_number}-${row.expense_date}-${index}`}>
                    <TableCell className="font-mono">{row.project_number}</TableCell>
                    <TableCell>{new Date(row.expense_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-mono">${row.fee_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.source_types.map((source) => (
                          <Badge key={source} variant="secondary">
                            {source}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{row.row_count}</TableCell>
                  </TableRow>
                ))}
                {(checks?.checks.duplicateCostCandidates.top || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No duplicate candidates found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingRuns ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run Time</TableHead>
                  <TableHead>Triggered By</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Mismatches</TableHead>
                  <TableHead className="text-right">Duplicates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(runs || []).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>{new Date(run.created_at).toLocaleString()}</TableCell>
                    <TableCell>{run.triggered_by_email || 'Unknown'}</TableCell>
                    <TableCell>{run.trigger_mode}</TableCell>
                    <TableCell className="text-right font-mono">{run.phase_mismatch_count}</TableCell>
                    <TableCell className="text-right font-mono">{run.duplicate_candidate_count}</TableCell>
                  </TableRow>
                ))}
                {(runs || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No runs recorded yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
