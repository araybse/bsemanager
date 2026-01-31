'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Views } from '@/lib/types/database'

export default function ContractsPage() {
  const supabase = createClient()

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['active-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_contracts_view')
        .select('*')
        .order('project_number')
        .order('phase_code')
      if (error) throw error
      return data as Views<'active_contracts_view'>[]
    },
  })

  // Group by project
  const groupedContracts = contracts?.reduce((acc, contract) => {
    const key = contract.project_number
    if (!acc[key]) {
      acc[key] = {
        project_number: contract.project_number,
        project_name: contract.project_name,
        phases: [],
      }
    }
    acc[key].phases.push(contract)
    return acc
  }, {} as Record<string, { project_number: string; project_name: string; phases: typeof contracts }>) || {}

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Active Contracts</h2>
        <p className="text-sm text-muted-foreground">
          View and manage contract phases for all projects
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        Object.values(groupedContracts).map((project) => (
          <Card key={project.project_number}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {project.project_number} — {project.project_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Phase</TableHead>
                    <TableHead>Phase Name</TableHead>
                    <TableHead className="w-[60px]">Type</TableHead>
                    <TableHead className="text-right">Total Fee</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Billed</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">This Month</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.phases.map((phase) => (
                    <TableRow key={phase.id}>
                      <TableCell className="font-mono">{phase.phase_code}</TableCell>
                      <TableCell>{phase.phase_name}</TableCell>
                      <TableCell>
                        <Badge variant={phase.billing_type === 'H' ? 'outline' : 'secondary'}>
                          {phase.billing_type === 'H' ? 'Hourly' : 'Lump'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(phase.total_fee)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(phase.pct_complete)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(phase.billed_to_date)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(phase.remaining)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {phase.bill_this_month > 0 ? formatCurrency(phase.bill_this_month) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      {!isLoading && Object.keys(groupedContracts).length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No active contracts found. Add projects and their phases to get started.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
