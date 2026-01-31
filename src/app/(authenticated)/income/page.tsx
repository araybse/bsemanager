'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Views } from '@/lib/types/database'

export default function IncomePage() {
  const supabase = createClient()

  const { data: income, isLoading } = useQuery({
    queryKey: ['income-tracker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('income_tracker')
        .select('*')
        .order('project_number')
        .order('phase_code')
      if (error) throw error
      return data as Views<'income_tracker'>[]
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Income</h2>
        <p className="text-sm text-muted-foreground">
          Contract amounts, invoiced, and remaining by phase
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Phase Name</TableHead>
                  <TableHead className="text-right">Contract</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {income?.map((row, idx) => (
                  <TableRow key={`${row.project_number}-${row.phase_code}-${idx}`}>
                    <TableCell>
                      <div className="font-mono">{row.project_number}</div>
                      <div className="text-xs text-muted-foreground">{row.project_name}</div>
                    </TableCell>
                    <TableCell className="font-mono">{row.phase_code}</TableCell>
                    <TableCell>{row.phase_name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.contract_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.invoiced)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.remaining)}
                    </TableCell>
                  </TableRow>
                ))}
                {income?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No income data found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
