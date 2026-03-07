'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
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
import { toast } from 'sonner'

type ProjectExpenseRow = {
  id: number
  project_number: string | null
  expense_date: string
  description: string | null
  fee_amount: number | null
  amount_to_charge: number | null
  is_reimbursable: boolean
  status: string
  invoice_number: string | null
}

export default function ReimbursablesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: reimbursables, isLoading } = useQuery({
    queryKey: ['reimbursables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_expenses')
        .select(
          'id, project_number, expense_date, description, fee_amount, amount_to_charge, is_reimbursable, status, invoice_number'
        )
        .in('status' as never, ['pending', 'invoiced'] as never)
        .order('expense_date', { ascending: false })
      if (error) throw error
      return (data || []) as ProjectExpenseRow[]
    },
  })

  const updateExpense = useMutation({
    mutationFn: async (payload: {
      id: number
      patch: { is_reimbursable?: boolean; status?: string }
    }) => {
      const { error } = await supabase
        .from('project_expenses')
        .update(payload.patch as never)
        .eq('id' as never, payload.id as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reimbursables'] })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update expense')
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
        <Button variant="outline" disabled>
          <Plus className="mr-2 h-4 w-4" />
          Add Reimbursable (Coming Soon)
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
                  <TableHead>Reimbursable</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reimbursables?.map((reimb) => (
                  <TableRow key={reimb.id}>
                    <TableCell>
                      <div className="font-mono">{reimb.project_number}</div>
                    </TableCell>
                    <TableCell>{formatDate(reimb.expense_date)}</TableCell>
                    <TableCell>{reimb.description || '—'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(reimb.fee_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(reimb.amount_to_charge)}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={reimb.is_reimbursable}
                        onCheckedChange={(checked) => {
                          updateExpense.mutate({
                            id: reimb.id,
                            patch: { is_reimbursable: Boolean(checked) },
                          })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={reimb.status === 'invoiced' ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() =>
                          updateExpense.mutate({
                            id: reimb.id,
                            patch: { status: reimb.status === 'invoiced' ? 'pending' : 'invoiced' },
                          })
                        }
                      >
                        {reimb.status === 'invoiced' ? 'Invoiced' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {reimb.invoice_number || '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {reimbursables?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
