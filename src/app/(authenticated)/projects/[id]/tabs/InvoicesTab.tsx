'use client'

import { Fragment, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
import type { Tables } from '@/lib/types/database'

type InvoicesTabProps = {
  invoices: Tables<'invoices'>[] | undefined
  loadingInvoices: boolean
  invoiceLineItems: Tables<'invoice_line_items'>[] | undefined
}

export function InvoicesTab({
  invoices,
  loadingInvoices,
  invoiceLineItems,
}: InvoicesTabProps) {
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set())

  const toggleInvoice = (invoiceId: number) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev)
      if (next.has(invoiceId)) {
        next.delete(invoiceId)
      } else {
        next.add(invoiceId)
      }
      return next
    })
  }

  const lineItemsByInvoice = useMemo(() => {
    const map = new Map<number, Tables<'invoice_line_items'>[]>()
    invoiceLineItems?.forEach((item) => {
      const list = map.get(item.invoice_id)
      if (list) {
        list.push(item)
      } else {
        map.set(item.invoice_id, [item])
      }
    })
    return map
  }, [invoiceLineItems])

  return (
    <TabsContent value="invoices" className="mt-4">
      <Card>
        <CardContent className="p-4">
          {loadingInvoices ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[140px]">Invoice #</TableHead>
                  <TableHead className="w-[140px]">Date Issued</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Paid</TableHead>
                  <TableHead className="w-[140px] text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices?.map((invoice) => {
                  const isExpanded = expandedInvoices.has(invoice.id)
                  const items = lineItemsByInvoice.get(invoice.id) || []
                  return (
                    <Fragment key={invoice.id}>
                      <TableRow className="hover:bg-muted/50">
                        <TableCell>
                          {items.length > 0 ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleInvoice(invoice.id)}
                              aria-label={isExpanded ? 'Collapse invoice' : 'Expand invoice'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{formatDate(invoice.date_issued)}</TableCell>
                        <TableCell>
                          <Badge variant={invoice.date_paid ? 'default' : 'secondary'}>
                            {invoice.date_paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {invoice.date_paid ? formatDate(invoice.date_paid) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(invoice.amount)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && items.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-0">
                            <div className="bg-muted/20 p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[40px]"></TableHead>
                                    <TableHead colSpan={2}>Phase</TableHead>
                                    <TableHead></TableHead>
                                    <TableHead></TableHead>
                                    <TableHead className="w-[140px] text-right">Amount</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {items.map((item, index) => (
                                    <TableRow key={`${item.invoice_id}-${index}`}>
                                      <TableCell className="w-[40px]"></TableCell>
                                      <TableCell colSpan={2}>{item.phase_name || 'Unassigned'}</TableCell>
                                      <TableCell></TableCell>
                                      <TableCell></TableCell>
                                      <TableCell className="w-[140px] text-right font-mono">
                                        {formatCurrency(Number(item.amount) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
                {invoices && invoices.length > 0 && (
                  <TableRow className="font-medium bg-muted/20">
                    <TableCell colSpan={5}>Total</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(
                        invoices.reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0)
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {invoices?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No invoices yet
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
