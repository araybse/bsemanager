'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
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

export default function ReimbursablesPage() {
  const supabase = createClient()

  const { data: reimbursables, isLoading } = useQuery({
    queryKey: ['reimbursables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reimbursables')
        .select('*')
        .order('date_charged', { ascending: false })
      if (error) throw error
      return data as Tables<'reimbursables'>[]
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Reimbursables</h2>
          <p className="text-sm text-muted-foreground">
            Third-party costs to be billed (15% markup)
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Reimbursable
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
                  <TableHead>Date Charged</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Fee Amount</TableHead>
                  <TableHead className="text-right">Amount to Charge</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reimbursables?.map((reimb) => (
                  <TableRow key={reimb.id}>
                    <TableCell>
                      <div className="font-mono">{reimb.project_number}</div>
                      {reimb.project_name && (
                        <div className="text-xs text-muted-foreground">{reimb.project_name}</div>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(reimb.date_charged)}</TableCell>
                    <TableCell>{reimb.fee_description}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(reimb.fee_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(reimb.amount_to_charge)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={reimb.invoice_id ? 'default' : 'secondary'}>
                        {reimb.invoice_id ? 'Invoiced' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {reimb.invoice_number || '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {reimbursables?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No reimbursables found
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
