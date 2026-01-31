'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Tables } from '@/lib/types/database'

export default function InvoicesPage() {
  const supabase = createClient()

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('date_issued', { ascending: false })
      if (error) throw error
      return data as Tables<'invoices'>[]
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Invoice Tracker</h2>
        <p className="text-sm text-muted-foreground">
          Track all invoices and their payment status
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
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Date Issued</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Budget Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices?.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono font-medium">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-mono">{invoice.project_number}</span>
                        <span className="text-muted-foreground"> — {invoice.project_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(invoice.date_issued)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(invoice.amount)}
                    </TableCell>
                    <TableCell>
                      {invoice.budget_date ? formatDate(invoice.budget_date) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={invoice.date_paid ? 'default' : 'secondary'}>
                        {invoice.date_paid ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.date_paid ? formatDate(invoice.date_paid) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {invoices?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No invoices found
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
