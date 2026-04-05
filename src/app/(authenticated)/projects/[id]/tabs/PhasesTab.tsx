'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatHours } from '@/lib/utils/format'

export interface PhaseRow {
  id: number | string
  phase_code: string
  phase_name: string | null
  billing_type: 'H' | 'L' | null
  total_fee: number | null
}

export interface LaborByPhaseEntry {
  hours: number
  cost: number
}

export interface PhasesTabProps {
  loadingPhases: boolean
  displayPhases: PhaseRow[]
  phases: PhaseRow[] | undefined | null
  totalFee: number
  totalInvoicedFromInvoices: number
  totalRemainingForTable: number
  totalReimbursableInvoicedFromInvoiceLines: number
  billedByPhaseName: Map<string, number>
  laborByPhase: Map<string, LaborByPhaseEntry>
}

export function PhasesTab({
  loadingPhases,
  displayPhases,
  phases,
  totalFee,
  totalInvoicedFromInvoices,
  totalRemainingForTable,
  totalReimbursableInvoicedFromInvoiceLines,
  billedByPhaseName,
  laborByPhase,
}: PhasesTabProps) {
  return (
    <TabsContent value="phases" className="mt-4">
      <Card>
        <CardContent className="p-4">
          {loadingPhases ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phase</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total Fee</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Labor</TableHead>
                  <TableHead className="text-right">Labor Cost</TableHead>
                  <TableHead className="text-right">Phase Multiplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayPhases.map((phase) => (
                  <TableRow key={phase.id}>
                    <TableCell className="font-mono">{phase.phase_code}</TableCell>
                    <TableCell>{phase.phase_name}</TableCell>
                    <TableCell>
                      {phase.billing_type ? (
                        <Badge variant={phase.billing_type === 'H' ? 'outline' : 'secondary'}>
                          {phase.billing_type === 'H' ? 'Hourly' : 'Lump Sum'}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {phase.phase_code === 'ZREIM' ? '—' : formatCurrency(phase.total_fee)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {phase.phase_code === 'ZREIM'
                        ? formatCurrency(totalReimbursableInvoicedFromInvoiceLines)
                        : formatCurrency(
                            billedByPhaseName.get((phase.phase_name || '').trim().toLowerCase()) || 0
                          )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {phase.phase_code === 'ZREIM'
                        ? '—'
                        : formatCurrency(
                            Number(phase.total_fee) -
                              (billedByPhaseName.get((phase.phase_name || '').trim().toLowerCase()) || 0)
                          )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatHours(
                        laborByPhase.get((phase.phase_name || '').trim().toLowerCase())?.hours || 0
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(
                        laborByPhase.get((phase.phase_name || '').trim().toLowerCase())?.cost || 0
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {(() => {
                        const laborCost =
                          laborByPhase.get((phase.phase_name || '').trim().toLowerCase())?.cost || 0
                        const billed =
                          billedByPhaseName.get((phase.phase_name || '').trim().toLowerCase()) || 0
                        if (!laborCost) return '—'
                        return (billed / laborCost).toFixed(2) + 'x'
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
                {phases && phases.length > 0 && (
                  <TableRow className="font-medium bg-muted/20">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totalFee)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totalInvoicedFromInvoices)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totalRemainingForTable)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatHours(
                        Array.from(laborByPhase.values()).reduce((sum, item) => sum + item.hours, 0)
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(
                        Array.from(laborByPhase.values()).reduce((sum, item) => sum + item.cost, 0)
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">—</TableCell>
                  </TableRow>
                )}
                {(!phases || phases.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No contract phases defined
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  )
}
