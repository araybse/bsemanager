'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
import {
  isExpenseInvoicedStatus,
  legacyStatusFromBillingStatus,
  normalizeExpenseBillingStatus,
  type ExpenseBillingStatus,
} from '@/lib/finance/expense-billing-status'
import { toast } from 'sonner'

type ProjectExpenseRow = {
  id: number
  vendor_name: string | null
  source_entity_type: string
  source_entity_id: string | null
  qb_vendor_name: string | null
  expense_date: string
  description: string | null
  fee_amount: number
  markup_pct: number
  amount_to_charge: number
  is_reimbursable: boolean
  status: string
  billing_status: string | null
  invoice_number: string | null
  project_number: string | null
  subcontract_contract_id: number | null
  source_active: boolean
}

type SubcontractContractRow = {
  id: number
  vendor_name: string
  description: string | null
  original_amount: number
  status: 'active' | 'closed' | 'cancelled'
}

type ExpensesTabProps = {
  expenses: ProjectExpenseRow[] | undefined
  loadingExpenses: boolean
  subcontractContracts: SubcontractContractRow[] | undefined
  normalizedProjectNumber: string | null
  projectId: number | null
}

export function ExpensesTab({
  expenses,
  loadingExpenses,
  subcontractContracts,
  normalizedProjectNumber,
  projectId,
}: ExpensesTabProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [updatingExpenseId, setUpdatingExpenseId] = useState<number | null>(null)
  const [updatingExpenseChargeId, setUpdatingExpenseChargeId] = useState<number | null>(null)
  const [updatingExpenseContractId, setUpdatingExpenseContractId] = useState<number | null>(null)
  const [expenseChargeDrafts, setExpenseChargeDrafts] = useState<Record<number, string>>({})
  const expenseChargeSaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (!expenses) return
    setExpenseChargeDrafts(() => {
      const next: Record<number, string> = {}
      expenses.forEach((expense) => {
        next[expense.id] = formatCurrency(Number(expense.amount_to_charge) || 0)
      })
      return next
    })
  }, [expenses])

  useEffect(() => {
    return () => {
      Object.values(expenseChargeSaveTimers.current).forEach((timer) => clearTimeout(timer))
      expenseChargeSaveTimers.current = {}
    }
  }, [])

  const parseCurrencyValue = (value: string) => {
    const normalized = value.replace(/[^0-9.-]/g, '')
    const numeric = Number(normalized)
    return Number.isFinite(numeric) ? numeric : NaN
  }

  const handleToggleExpenseReimbursable = async (expenseId: number, checked: boolean) => {
    setUpdatingExpenseId(expenseId)
    try {
      const nextBillingStatus: ExpenseBillingStatus = checked ? 'approved' : 'ignored'
      const { error } = await supabase
        .from('project_expenses')
        .update({
          is_reimbursable: checked,
          billing_status: nextBillingStatus,
          status: legacyStatusFromBillingStatus(nextBillingStatus),
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', expenseId as never)
      if (error) throw error

      queryClient.invalidateQueries({
        queryKey: ['project-expenses', normalizedProjectNumber, projectId],
      })
      toast.success('Expense updated')
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update expense')
    } finally {
      setUpdatingExpenseId(null)
    }
  }

  const linkExpenseToContract = async (expenseId: number, contractId: number | null) => {
    setUpdatingExpenseContractId(expenseId)
    try {
      const { error } = await supabase
        .from('project_expenses')
        .update({
          subcontract_contract_id: contractId,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', expenseId as never)
      if (error) throw error

      queryClient.invalidateQueries({
        queryKey: ['project-expenses', normalizedProjectNumber, projectId],
      })
      toast.success('Expense contract link updated')
    } catch (error) {
      toast.error((error as Error).message || 'Failed to link expense to contract')
    } finally {
      setUpdatingExpenseContractId(null)
    }
  }

  const updateExpenseAmountToCharge = async (
    expenseId: number,
    feeAmount: number,
    amountToCharge: number
  ) => {
    const safeFee = Number(feeAmount) || 0
    const safeAmount = Math.max(0, Number(amountToCharge) || 0)
    const markupPct =
      safeFee > 0 ? Math.max(0, Number(((safeAmount / safeFee) - 1).toFixed(4))) : 0

    setUpdatingExpenseChargeId(expenseId)
    try {
      const { error } = await supabase
        .from('project_expenses')
        .update({
          markup_pct: markupPct,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', expenseId as never)
      if (error) throw error
      queryClient.invalidateQueries({
        queryKey: ['project-expenses', normalizedProjectNumber, projectId],
      })
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update amount to charge')
    } finally {
      setUpdatingExpenseChargeId(null)
    }
  }

  const applyDefaultExpenseMarkup = async (expenseId: number, feeAmount: number) => {
    const amount = Math.max(0, (Number(feeAmount) || 0) * 1.15)
    setExpenseChargeDrafts((prev) => ({ ...prev, [expenseId]: formatCurrency(amount) }))
    await updateExpenseAmountToCharge(expenseId, feeAmount, amount)
  }

  const scheduleExpenseChargeSave = (expenseId: number, feeAmount: number, draftValue: string) => {
    const parsed = parseCurrencyValue(draftValue)
    if (Number.isNaN(parsed)) return
    if (expenseChargeSaveTimers.current[expenseId]) {
      clearTimeout(expenseChargeSaveTimers.current[expenseId])
    }
    expenseChargeSaveTimers.current[expenseId] = setTimeout(() => {
      void updateExpenseAmountToCharge(expenseId, feeAmount, Math.max(0, Number(parsed.toFixed(2))))
      delete expenseChargeSaveTimers.current[expenseId]
    }, 700)
  }

  return (
    <TabsContent value="expenses" className="mt-4">
      <Card>
        <CardContent className="p-4">
          {loadingExpenses ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Reimbursable</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead className="text-right">Amount to Charge</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses?.map((expense) => {
                  const billingStatus = normalizeExpenseBillingStatus(expense)
                  const isInvoiced =
                    Boolean(expense.invoice_number) || isExpenseInvoicedStatus(billingStatus)
                  const statusLabel = expense.is_reimbursable
                    ? isInvoiced
                      ? 'Invoiced'
                      : 'To Be Invoiced'
                    : '—'

                  return (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {(expense.source_entity_type === 'contract_labor'
                          ? expense.qb_vendor_name || expense.vendor_name
                          : expense.vendor_name) || '—'}
                      </TableCell>
                      <TableCell>{formatDate(expense.expense_date)}</TableCell>
                      <TableCell>{expense.description || '—'}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(Number(expense.fee_amount) || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={Boolean(expense.is_reimbursable)}
                          disabled={updatingExpenseId === expense.id}
                          onCheckedChange={(checked) =>
                            void handleToggleExpenseReimbursable(expense.id, Boolean(checked))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={
                            expense.subcontract_contract_id
                              ? String(expense.subcontract_contract_id)
                              : 'unassigned'
                          }
                          disabled={updatingExpenseContractId === expense.id}
                          onValueChange={(value) =>
                            void linkExpenseToContract(
                              expense.id,
                              value === 'unassigned' ? null : Number(value)
                            )
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {(subcontractContracts || []).map((contract) => (
                              <SelectItem key={contract.id} value={String(contract.id)}>
                                {contract.vendor_name}
                                {contract.description ? ` - ${contract.description}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {expense.is_reimbursable ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              disabled={updatingExpenseChargeId === expense.id}
                              onClick={() =>
                                void applyDefaultExpenseMarkup(expense.id, Number(expense.fee_amount) || 0)
                              }
                            >
                              15%
                            </Button>
                            <Input
                              value={
                                expenseChargeDrafts[expense.id] ??
                                formatCurrency(Number(expense.amount_to_charge) || 0)
                              }
                              className="h-8 w-[130px] text-right font-mono"
                              disabled={updatingExpenseChargeId === expense.id}
                              onChange={(event) => {
                                const nextValue = event.target.value
                                setExpenseChargeDrafts((prev) => ({
                                  ...prev,
                                  [expense.id]: nextValue,
                                }))
                                scheduleExpenseChargeSave(
                                  expense.id,
                                  Number(expense.fee_amount) || 0,
                                  nextValue
                                )
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.currentTarget.blur()
                                }
                              }}
                              onBlur={(event) => {
                                if (expenseChargeSaveTimers.current[expense.id]) {
                                  clearTimeout(expenseChargeSaveTimers.current[expense.id])
                                  delete expenseChargeSaveTimers.current[expense.id]
                                }
                                const parsed = parseCurrencyValue(event.target.value)
                                if (Number.isNaN(parsed)) {
                                  setExpenseChargeDrafts((prev) => ({
                                    ...prev,
                                    [expense.id]: formatCurrency(Number(expense.amount_to_charge) || 0),
                                  }))
                                  return
                                }
                                const rounded = Math.max(0, Number(parsed.toFixed(2)))
                                setExpenseChargeDrafts((prev) => ({
                                  ...prev,
                                  [expense.id]: formatCurrency(rounded),
                                }))
                                void updateExpenseAmountToCharge(
                                  expense.id,
                                  Number(expense.fee_amount) || 0,
                                  rounded
                                )
                              }}
                            />
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusLabel === 'Invoiced' ? 'default' : 'secondary'}>
                          {statusLabel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {expenses && expenses.length > 0 && (
                  <TableRow className="font-medium bg-muted/20">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(
                        expenses.reduce((sum, item) => sum + (Number(item.fee_amount) || 0), 0)
                      )}
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right font-mono">
                      {formatCurrency(
                        expenses.reduce(
                          (sum, item) =>
                            sum +
                            (item.is_reimbursable ? Number(item.amount_to_charge) || 0 : 0),
                          0
                        )
                      )}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
                {expenses?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No expenses
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
