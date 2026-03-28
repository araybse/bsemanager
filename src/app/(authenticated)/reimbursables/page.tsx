'use client'
import { usePermissionRedirect } from '@/lib/auth/use-permission-redirect'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  type ExpenseBillingStatus,
  isExpenseInvoicedStatus,
  normalizeExpenseBillingStatus,
} from '@/lib/finance/expense-billing-status'

type ProjectExpenseRow = {
  id: number
  project_number: string | null
  vendor_name: string | null
  expense_date: string
  date_paid: string | null
  description: string | null
  fee_amount: number | null
  amount_to_charge: number | null
  is_reimbursable: boolean
  status: string
  billing_status: string | null
  invoice_number: string | null
  source_entity_type: string | null
  subcontract_contract_id: number | null
  contract_number?: string | null
  source_active?: boolean | null
}

type SortField =
  | 'project'
  | 'vendor'
  | 'date_charged'
  | 'description'
  | 'expense_type'
  | 'fee_amount'
  | 'amount_to_charge'
  | 'date_paid'
  | 'status'
  | 'invoice_number'

type SortDirection = 'asc' | 'desc'

export default function ReimbursablesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [sortField, setSortField] = useState<SortField>('date_charged')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const { data: reimbursables, isLoading } = useQuery({
    queryKey: ['reimbursables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_expenses')
        .select(
          'id, project_number, vendor_name, expense_date, date_paid, description, fee_amount, amount_to_charge, is_reimbursable, status, billing_status, invoice_number, source_entity_type, subcontract_contract_id, source_active, source_system'
        )
        .eq('source_system', 'qbo')
        .in('source_entity_type', ['project_expense', 'contract_labor'])
        .not('project_number', 'is', null)
        .neq('source_active', false)
        .order('expense_date', { ascending: false })
      if (error) throw error
      const rows = (data || []) as ProjectExpenseRow[]

      const contractIds = Array.from(
        new Set(
          rows
            .map((row) => row.subcontract_contract_id)
            .filter((value): value is number => typeof value === 'number')
        )
      )

      if (!contractIds.length) return rows

      const { data: contracts, error: contractError } = await supabase
        .from('subcontract_contracts')
        .select('id, contract_number')
        .in('id', contractIds)

      if (contractError) throw contractError

      const contractNumberById = new Map<number, string | null>()
      ;((contracts as Array<{ id: number; contract_number: string | null }> | null) || []).forEach(
        (contract) => {
          contractNumberById.set(contract.id, contract.contract_number)
        }
      )

      return rows.map((row) => ({
        ...row,
        contract_number:
          typeof row.subcontract_contract_id === 'number'
            ? (contractNumberById.get(row.subcontract_contract_id) ?? null)
            : null,
      }))
    },
  })

  const updateExpense = useMutation({
    mutationFn: async (payload: {
      id: number
      patch: { is_reimbursable?: boolean; status?: string; billing_status?: ExpenseBillingStatus }
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

  const sortedExpenses = useMemo(() => {
    const rows = [...(reimbursables || [])]
    rows.sort((a, b) => {
      const aStatus = normalizeExpenseBillingStatus(a)
      const bStatus = normalizeExpenseBillingStatus(b)
      let aVal: string | number | Date | null = null
      let bVal: string | number | Date | null = null

      switch (sortField) {
        case 'project':
          aVal = a.project_number || ''
          bVal = b.project_number || ''
          break
        case 'vendor':
          aVal = a.vendor_name || ''
          bVal = b.vendor_name || ''
          break
        case 'date_charged':
          aVal = a.expense_date ? new Date(a.expense_date) : null
          bVal = b.expense_date ? new Date(b.expense_date) : null
          break
        case 'description':
          aVal = a.description || ''
          bVal = b.description || ''
          break
        case 'expense_type':
          aVal = a.subcontract_contract_id ? 'contract labor' : 'general expense'
          bVal = b.subcontract_contract_id ? 'contract labor' : 'general expense'
          break
        case 'fee_amount':
          aVal = Number(a.fee_amount) || 0
          bVal = Number(b.fee_amount) || 0
          break
        case 'amount_to_charge':
          aVal = Number(a.amount_to_charge) || 0
          bVal = Number(b.amount_to_charge) || 0
          break
        case 'date_paid':
          aVal = a.date_paid ? new Date(a.date_paid) : null
          bVal = b.date_paid ? new Date(b.date_paid) : null
          break
        case 'status':
          aVal = aStatus
          bVal = bStatus
          break
        case 'invoice_number':
          aVal = a.invoice_number || ''
          bVal = b.invoice_number || ''
          break
      }

      if (aVal === null) return 1
      if (bVal === null) return -1
      if (aVal instanceof Date && bVal instanceof Date) {
        return sortDirection === 'asc'
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime()
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    return rows
  }, [reimbursables, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortField(field)
    setSortDirection('asc')
  }

  const renderSortButton = (field: SortField, label: string) => {
    const isActive = sortField === field
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {label}
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Expenses</h2>
          <p className="text-sm text-muted-foreground">
            All job-related QuickBooks expenses with reimbursable controls
          </p>
        </div>
        <Button variant="outline" disabled>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense (from QuickBooks)
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
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{renderSortButton('project', 'Project')}</TableHead>
                  <TableHead>{renderSortButton('date_charged', 'Date Charged')}</TableHead>
                  <TableHead>{renderSortButton('vendor', 'Vendor')}</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>{renderSortButton('description', 'Description')}</TableHead>
                  <TableHead>{renderSortButton('expense_type', 'Expense Type')}</TableHead>
                  <TableHead className="text-right">{renderSortButton('fee_amount', 'Fee Amount')}</TableHead>
                  <TableHead className="text-right">{renderSortButton('amount_to_charge', 'Amount to Charge')}</TableHead>
                  <TableHead>Reimbursable</TableHead>
                  <TableHead>{renderSortButton('date_paid', 'Date Paid')}</TableHead>
                  <TableHead>{renderSortButton('status', 'Status')}</TableHead>
                  <TableHead>{renderSortButton('invoice_number', 'Invoice #')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExpenses.map((reimb) => (
                  <TableRow key={reimb.id}>
                    <TableCell>
                      <div className="font-mono">{reimb.project_number}</div>
                    </TableCell>
                    <TableCell>{formatDate(reimb.expense_date)}</TableCell>
                    <TableCell>{reimb.vendor_name || '—'}</TableCell>
                    <TableCell className="font-mono">
                      {reimb.contract_number || '—'}
                    </TableCell>
                    <TableCell>{reimb.description || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {reimb.subcontract_contract_id
                          ? 'Contract Labor'
                          : reimb.source_entity_type === 'contract_labor'
                            ? 'Contract Labor (Unmatched)'
                            : 'General Expense'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(reimb.fee_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(reimb.amount_to_charge)}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={reimb.is_reimbursable}
                        disabled={Boolean(reimb.subcontract_contract_id)}
                        onCheckedChange={(checked) => {
                          updateExpense.mutate({
                            id: reimb.id,
                            patch: { is_reimbursable: Boolean(checked) },
                          })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {reimb.date_paid ? formatDate(reimb.date_paid) : '—'}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const isContractLabor = Boolean(reimb.subcontract_contract_id) || reimb.source_entity_type === 'contract_labor'
                        const billingStatus = normalizeExpenseBillingStatus(reimb)
                        const badgeText = isContractLabor
                          ? reimb.date_paid
                            ? 'Paid'
                            : 'Pending'
                          : reimb.is_reimbursable
                            ? billingStatus === 'paid'
                              ? 'Paid'
                              : billingStatus === 'invoiced'
                                ? 'Invoiced'
                                : 'Pending'
                            : 'Not Reimbursable'
                        const isPositive = badgeText === 'Paid' || badgeText === 'Invoiced'
                        return (
                      <Badge
                        variant={isPositive || isExpenseInvoicedStatus(billingStatus) ? 'default' : 'secondary'}
                      >
                        {badgeText}
                      </Badge>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="font-mono">
                      {reimb.invoice_number || '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {sortedExpenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No expenses found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
