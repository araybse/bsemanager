'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import { Plus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Tables } from '@/lib/types/database'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ContractLaborPage() {
  const supabase = createClient()

  const { data: labor, isLoading } = useQuery({
    queryKey: ['contract-labor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_labor')
        .select('*')
        .order('project_number')
        .order('vendor_name')
      if (error) throw error
      return data as Tables<'contract_labor'>[]
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Contract Labor</h2>
          <p className="text-sm text-muted-foreground">
            Sub-consultant and contractor expenses by project
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Entry
        </Button>
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
                  <TableHead>Vendor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labor?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-mono">{entry.project_number}</div>
                      {entry.project_name && (
                        <div className="text-xs text-muted-foreground">{entry.project_name}</div>
                      )}
                    </TableCell>
                    <TableCell>{entry.vendor_name}</TableCell>
                    <TableCell>{entry.description || '—'}</TableCell>
                    <TableCell>{entry.year}</TableCell>
                    <TableCell>{MONTHS[entry.month - 1]}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(entry.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {labor?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No contract labor entries found
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
