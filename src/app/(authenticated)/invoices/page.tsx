'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import { ArrowUpDown, ArrowUp, ArrowDown, X, ChevronDown, ChevronRight } from 'lucide-react'
import type { Tables } from '@/lib/types/database'

type SortField = 'invoice_number' | 'project_number' | 'date_issued' | 'amount' | 'date_paid'
type SortDirection = 'asc' | 'desc'

interface InvoiceWithLineItems extends Tables<'invoices'> {
  line_items?: Tables<'invoice_line_items'>[]
}

export default function InvoicesPage() {
  const supabase = createClient()
  
  // Filter state
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Sort state
  const [sortField, setSortField] = useState<SortField>('date_issued')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  
  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Fetch invoices
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices-with-line-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('date_issued', { ascending: false })
      if (error) throw error
      return data as Tables<'invoices'>[]
    },
  })

  // Fetch line items separately
  const { data: lineItems } = useQuery({
    queryKey: ['invoice-line-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_line_items')
        .select('*')
      if (error) throw error
      return data as Tables<'invoice_line_items'>[]
    },
  })

  // Group line items by invoice_id
  const lineItemsByInvoice = useMemo(() => {
    const map: Record<number, Tables<'invoice_line_items'>[]> = {}
    lineItems?.forEach(item => {
      if (!map[item.invoice_id]) {
        map[item.invoice_id] = []
      }
      map[item.invoice_id].push(item)
    })
    return map
  }, [lineItems])

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    if (!invoices) return { projects: [] }
    
    const projects = [...new Set(invoices.map(i => i.project_number).filter(Boolean))].sort()
    
    return { projects }
  }, [invoices])

  // Filter and sort invoices
  const filteredInvoices = useMemo(() => {
    if (!invoices) return []
    
    let filtered = invoices.filter(invoice => {
      // Date range filter
      if (dateFrom && invoice.date_issued < dateFrom) return false
      if (dateTo && invoice.date_issued > dateTo) return false
      
      // Project filter
      if (projectFilter !== 'all' && invoice.project_number !== projectFilter) return false
      
      // Status filter
      if (statusFilter === 'paid' && !invoice.date_paid) return false
      if (statusFilter === 'unpaid' && invoice.date_paid) return false
      
      return true
    })
    
    // Sort
    filtered.sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      
      switch (sortField) {
        case 'invoice_number':
          aVal = a.invoice_number || ''
          bVal = b.invoice_number || ''
          break
        case 'project_number':
          aVal = a.project_number || ''
          bVal = b.project_number || ''
          break
        case 'date_issued':
          aVal = a.date_issued || ''
          bVal = b.date_issued || ''
          break
        case 'amount':
          aVal = a.amount || 0
          bVal = b.amount || 0
          break
        case 'date_paid':
          aVal = a.date_paid || ''
          bVal = b.date_paid || ''
          break
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    
    return filtered
  }, [invoices, dateFrom, dateTo, projectFilter, statusFilter, sortField, sortDirection])

  // Calculate totals
  const totalAmount = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
  }, [filteredInvoices])

  const unpaidAmount = useMemo(() => {
    return filteredInvoices
      .filter(inv => !inv.date_paid)
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  }, [filteredInvoices])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-4 w-4" />
      : <ArrowDown className="ml-1 h-4 w-4" />
  }

  const clearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setProjectFilter('all')
    setStatusFilter('all')
  }

  const toggleRow = (invoiceId: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId)
    } else {
      newExpanded.add(invoiceId)
    }
    setExpandedRows(newExpanded)
  }

  const hasActiveFilters = dateFrom || dateTo || projectFilter !== 'all' || statusFilter !== 'all'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Invoice Tracker</h2>
        <p className="text-sm text-muted-foreground">
          Track all invoices and their payment status
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Date To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Project</label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {filterOptions.projects.map(proj => (
                    <SelectItem key={proj} value={proj}>{proj}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{filteredInvoices.length} invoices</span>
        <span>•</span>
        <span>Total: {formatCurrency(totalAmount)}</span>
        <span>•</span>
        <span>Unpaid: {formatCurrency(unpaidAmount)}</span>
      </div>

      {/* Table */}
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
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('invoice_number')}
                  >
                    <div className="flex items-center">
                      Invoice #
                      <SortIcon field="invoice_number" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('project_number')}
                  >
                    <div className="flex items-center">
                      Project
                      <SortIcon field="project_number" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('date_issued')}
                  >
                    <div className="flex items-center">
                      Date Issued
                      <SortIcon field="date_issued" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center justify-end">
                      Amount
                      <SortIcon field="amount" />
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('date_paid')}
                  >
                    <div className="flex items-center">
                      Date Paid
                      <SortIcon field="date_paid" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const invoiceLineItems = lineItemsByInvoice[invoice.id] || []
                  const hasLineItems = invoiceLineItems.length > 0
                  const isExpanded = expandedRows.has(invoice.id)
                  
                  return (
                    <Collapsible key={invoice.id} open={isExpanded} asChild>
                      <>
                        <TableRow className={hasLineItems ? 'cursor-pointer hover:bg-muted/50' : ''}>
                          <TableCell className="w-[40px]">
                            {hasLineItems && (
                              <CollapsibleTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0"
                                  onClick={() => toggleRow(invoice.id)}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            )}
                          </TableCell>
                          <TableCell 
                            className="font-mono font-medium"
                            onClick={() => hasLineItems && toggleRow(invoice.id)}
                          >
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell onClick={() => hasLineItems && toggleRow(invoice.id)}>
                            <div>
                              <span className="font-mono">{invoice.project_number}</span>
                              <span className="text-muted-foreground"> — {invoice.project_name}</span>
                            </div>
                          </TableCell>
                          <TableCell onClick={() => hasLineItems && toggleRow(invoice.id)}>
                            {formatDate(invoice.date_issued)}
                          </TableCell>
                          <TableCell 
                            className="text-right font-mono"
                            onClick={() => hasLineItems && toggleRow(invoice.id)}
                          >
                            {formatCurrency(invoice.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={invoice.date_paid ? 'default' : 'secondary'}>
                              {invoice.date_paid ? 'Paid' : 'Unpaid'}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={() => hasLineItems && toggleRow(invoice.id)}>
                            {invoice.date_paid ? formatDate(invoice.date_paid) : '—'}
                          </TableCell>
                        </TableRow>
                        {hasLineItems && (
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={7} className="p-0">
                                <div className="px-8 py-3">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">
                                    Invoice Line Items
                                  </div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="hover:bg-transparent">
                                        <TableHead className="h-8 text-xs">Phase</TableHead>
                                        <TableHead className="h-8 text-xs text-right">Amount</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {invoiceLineItems.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-muted/50">
                                          <TableCell className="py-1.5">{item.phase_name}</TableCell>
                                          <TableCell className="py-1.5 text-right font-mono">
                                            {formatCurrency(item.amount)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                      <TableRow className="hover:bg-transparent border-t">
                                        <TableCell className="py-1.5 font-medium">Total</TableCell>
                                        <TableCell className="py-1.5 text-right font-mono font-medium">
                                          {formatCurrency(invoiceLineItems.reduce((sum, item) => sum + item.amount, 0))}
                                        </TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        )}
                      </>
                    </Collapsible>
                  )
                })}
                {filteredInvoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {hasActiveFilters ? 'No invoices match the current filters' : 'No invoices found'}
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
