'use client'

import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePermissionRedirect } from '@/lib/auth/use-permission-redirect'
import { endOfMonth, format, subMonths } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils/format'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight } from 'lucide-react'

type AccountingLinesPayload = {
  snapshot: {
    id: number
    report_type: 'profit_and_loss' | 'balance_sheet'
    period_start: string
    period_end: string
    basis: 'cash' | 'accrual'
    fetched_at: string
  }
  lines: Array<{
    section: string | null
    account_name: string
    amount: number
    sort_order: number
    depth: number
    is_total: boolean
    parent_key?: string | null
    row_key?: string | null
  }>
}

type ProfitLossPayload = AccountingLinesPayload & {
  kpis: {
    total_income: number
    total_cogs: number
    gross_profit: number
    total_expenses: number
    net_income: number
  }
}

type BalanceSheetPayload = AccountingLinesPayload & {
  kpis: {
    total_assets: number
    total_liabilities: number
    total_equity: number
  }
}

export default function AccountingPage() {
  // Check permissions - admin only
  usePermissionRedirect({ allowedRoles: ['admin'] })

  const COMPANY_START_YEAR = 2023
  const COMPANY_START_MONTH_INDEX = 4 // May (0-based)
  const queryClient = useQueryClient()
  const [periodMode, setPeriodMode] = useState<'month' | 'year'>('month')
  const [selectedMonth, setSelectedMonth] = useState(() => format(subMonths(new Date(), 1), 'yyyy-MM'))
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()))
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual')
  const [collapsedProfitLossSections, setCollapsedProfitLossSections] = useState<Record<string, boolean>>({})
  const [collapsedProfitLossSubsections, setCollapsedProfitLossSubsections] = useState<Record<string, boolean>>({})
  const [cashBackfillProgress, setCashBackfillProgress] = useState<{
    current: number
    total: number
    month: string
  } | null>(null)

  const monthOptions = useMemo(() => {
    const today = new Date()
    const companyStart = new Date(COMPANY_START_YEAR, COMPANY_START_MONTH_INDEX, 1)
    const monthsCount =
      (today.getFullYear() - companyStart.getFullYear()) * 12 +
      (today.getMonth() - companyStart.getMonth()) +
      1
    return Array.from({ length: Math.max(1, monthsCount) }, (_, index) => {
      const monthDate = subMonths(today, index)
      return {
        value: format(monthDate, 'yyyy-MM'),
        label: format(monthDate, 'MMMM yyyy'),
      }
    })
  }, [COMPANY_START_MONTH_INDEX, COMPANY_START_YEAR])

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const yearsCount = currentYear - COMPANY_START_YEAR + 1
    return Array.from({ length: Math.max(1, yearsCount) }, (_, index) => String(currentYear - index))
  }, [COMPANY_START_YEAR])

  const monthlyCashBackfillRange = (() => {
    const start = new Date(COMPANY_START_YEAR, COMPANY_START_MONTH_INDEX, 1)
    const now = new Date()
    const lastCompletedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    if (start > lastCompletedMonth) return []

    const months: string[] = []
    let cursor = new Date(start)
    while (cursor <= lastCompletedMonth) {
      months.push(format(cursor, 'yyyy-MM'))
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
    return months
  })()

  const periodLabel = useMemo(() => {
    if (periodMode === 'year') return selectedYear
    return monthOptions.find((option) => option.value === selectedMonth)?.label || selectedMonth
  }, [monthOptions, periodMode, selectedMonth, selectedYear])

  const { periodStart, periodEnd } = useMemo(() => {
    if (periodMode === 'year') {
      return {
        periodStart: `${selectedYear}-01-01`,
        periodEnd: `${selectedYear}-12-31`,
      }
    }
    const [year, month] = selectedMonth.split('-').map(Number)
    const start = new Date(year, month - 1, 1)
    const end = endOfMonth(start)
    return {
      periodStart: format(start, 'yyyy-MM-dd'),
      periodEnd: format(end, 'yyyy-MM-dd'),
    }
  }, [periodMode, selectedMonth, selectedYear])

  const profitLossQuery = useQuery({
    queryKey: ['accounting-profit-loss', periodStart, periodEnd, basis],
    queryFn: async () => {
      const response = await fetch(
        `/api/accounting/profit-loss?period_start=${encodeURIComponent(periodStart)}&period_end=${encodeURIComponent(periodEnd)}&basis=${encodeURIComponent(basis)}`
      )
      if (response.status === 404) return null
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload.error || 'Failed to load Profit & Loss snapshot')
      }
      return (await response.json()) as ProfitLossPayload
    },
  })

  const balanceSheetQuery = useQuery({
    queryKey: ['accounting-balance-sheet', periodStart, periodEnd, basis],
    queryFn: async () => {
      const response = await fetch(
        `/api/accounting/balance-sheet?period_start=${encodeURIComponent(periodStart)}&period_end=${encodeURIComponent(periodEnd)}&basis=${encodeURIComponent(basis)}`
      )
      if (response.status === 404) return null
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload.error || 'Failed to load Balance Sheet snapshot')
      }
      return (await response.json()) as BalanceSheetPayload
    },
  })

  const syncProfitLossMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/accounting/profit-loss/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_start: periodStart,
          period_end: periodEnd,
          basis,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to refresh QuickBooks Profit & Loss snapshot')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Profit & Loss snapshot refreshed from QuickBooks')
      queryClient.invalidateQueries({
        queryKey: ['accounting-profit-loss', periodStart, periodEnd, basis],
      })
    },
    onError: (error) => {
      toast.error((error as Error).message || 'Failed to refresh Profit & Loss snapshot')
    },
  })

  const backfillMonthlyCashProfitLossMutation = useMutation({
    mutationFn: async () => {
      const months = monthlyCashBackfillRange
      if (months.length === 0) return { refreshed: 0 }

      for (let index = 0; index < months.length; index += 1) {
        const month = months[index]
        const [year, monthNumber] = month.split('-').map(Number)
        const periodStartDate = new Date(year, monthNumber - 1, 1)
        const periodEndDate = endOfMonth(periodStartDate)
        setCashBackfillProgress({
          current: index + 1,
          total: months.length,
          month,
        })

        const response = await fetch('/api/accounting/profit-loss/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            period_start: format(periodStartDate, 'yyyy-MM-dd'),
            period_end: format(periodEndDate, 'yyyy-MM-dd'),
            basis: 'cash',
          }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || `Failed to refresh cash-basis P&L snapshot for ${month}`)
        }
      }

      return { refreshed: months.length }
    },
    onSuccess: (result) => {
      setCashBackfillProgress(null)
      toast.success(`Cash-basis monthly P&L refreshed for ${result.refreshed} month(s)`)
      queryClient.invalidateQueries({
        queryKey: ['accounting-profit-loss'],
      })
      queryClient.invalidateQueries({
        queryKey: ['dashboard-gross-profit-vs-expenses-cash'],
      })
    },
    onError: (error) => {
      setCashBackfillProgress(null)
      toast.error((error as Error).message || 'Failed monthly cash-basis P&L backfill')
    },
  })

  const syncBalanceSheetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/accounting/balance-sheet/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_start: periodStart,
          period_end: periodEnd,
          basis,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to refresh QuickBooks Balance Sheet snapshot')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Balance Sheet snapshot refreshed from QuickBooks')
      queryClient.invalidateQueries({
        queryKey: ['accounting-balance-sheet', periodStart, periodEnd, basis],
      })
    },
    onError: (error) => {
      toast.error((error as Error).message || 'Failed to refresh Balance Sheet snapshot')
    },
  })

  type BalanceSheetLine = {
    section: string | null
    account_name: string
    amount: number
    sort_order: number
    depth: number
    is_total: boolean
  }

  const groupLines = (lines: BalanceSheetLine[] | undefined): Array<[string, BalanceSheetLine[]]> => {
    const grouped = new Map<string, BalanceSheetLine[]>()
    for (const line of lines ?? []) {
      const section = line.section || 'Other'
      const existing = grouped.get(section)
      if (existing) {
        existing.push(line)
      } else {
        grouped.set(section, [line])
      }
    }
    return Array.from(grouped.entries())
  }

  type ProfitLossLine = ProfitLossPayload['lines'][number]
  type ProfitLossSubsection = {
    key: string
    title: string
    total: number
    children: ProfitLossLine[]
  }
  type ProfitLossMajorSection = {
    key: string
    title: string
    total: number
    subsections: ProfitLossSubsection[]
    standalone: ProfitLossLine[]
  }

  const makeSubsections = useCallback(
    (lines: ProfitLossLine[], sectionPrefix: string, rootParentKeys: string[]) => {
      const sorted = [...lines].sort((a, b) => a.sort_order - b.sort_order)
      const subsections: ProfitLossSubsection[] = []
      const groupedByParent = new Map<string, ProfitLossLine[]>()
      const consumedSortOrders = new Set<number>()
      const rootKeysNormalized = new Set(rootParentKeys.map((key) => key.trim().toLowerCase()))

      for (const line of sorted) {
        const parentKey = (line.parent_key || '').trim()
        const parentKeyNormalized = parentKey.toLowerCase()
        if (!parentKey || rootKeysNormalized.has(parentKeyNormalized)) continue
        if (!groupedByParent.has(parentKey)) groupedByParent.set(parentKey, [])
        groupedByParent.get(parentKey)!.push(line)
      }

      for (const [parentKey, group] of groupedByParent.entries()) {
        const groupSorted = [...group].sort((a, b) => a.sort_order - b.sort_order)
        const totalLine =
          groupSorted.find((line) => line.is_total && line.account_name.toLowerCase().startsWith('total ')) || null
        const children = groupSorted.filter((line) => !totalLine || line.sort_order !== totalLine.sort_order)
        const total = totalLine ? totalLine.amount : children.reduce((sum, line) => sum + line.amount, 0)
        const key = `${sectionPrefix}::${parentKey}`

        groupSorted.forEach((line) => consumedSortOrders.add(line.sort_order))
        subsections.push({
          key,
          title: totalLine?.account_name || parentKey,
          total,
          children,
        })
      }

      subsections.sort((a, b) => {
        const aOrder = Math.min(...a.children.map((line) => line.sort_order), Number.MAX_SAFE_INTEGER)
        const bOrder = Math.min(...b.children.map((line) => line.sort_order), Number.MAX_SAFE_INTEGER)
        return aOrder - bOrder
      })

      const standalone = sorted.filter((line) => !consumedSortOrders.has(line.sort_order))
      return { subsections, standalone }
    },
    []
  )

  const profitLossSections = useMemo(() => {
    const lines = [...(profitLossQuery.data?.lines || [])].sort((a, b) => a.sort_order - b.sort_order)
    const netNames = new Set(['net operating income', 'net other income', 'net income'])
    const netRows = lines.filter((line) => netNames.has(line.account_name.trim().toLowerCase()))
    const remaining = lines.filter((line) => !netNames.has(line.account_name.trim().toLowerCase()))

    const incomeLines = remaining.filter((line) => {
      const section = (line.section || '').toLowerCase()
      const name = line.account_name.toLowerCase()
      return section.includes('income') || section.includes('cost of goods sold') || name === 'gross profit'
    })
    const expenseLines = remaining.filter((line) => !incomeLines.includes(line))

    const incomeGroups = makeSubsections(incomeLines, 'income', ['Income', 'Cost of Goods Sold'])
    const expenseGroups = makeSubsections(expenseLines, 'expenses', ['Expenses'])
    const netGroups = makeSubsections(netRows, 'net', [])

    const sections: ProfitLossMajorSection[] = [
      {
        key: 'income_gross_profit',
        title: 'Income & Gross Profit',
        total:
          incomeLines.find((row) => row.account_name.trim().toLowerCase() === 'gross profit')?.amount ??
          profitLossQuery.data?.kpis.gross_profit ??
          0,
        subsections: incomeGroups.subsections,
        standalone: incomeGroups.standalone,
      },
      {
        key: 'expenses',
        title: 'Expenses',
        total:
          expenseLines.find((row) => row.account_name.trim().toLowerCase() === 'total expenses')?.amount ??
          expenseLines.reduce((sum, row) => sum + (row.is_total ? row.amount : 0), 0),
        subsections: expenseGroups.subsections,
        standalone: expenseGroups.standalone,
      },
      {
        key: 'net_summary',
        title: 'Net Summary',
        total: netRows.find((row) => row.account_name.trim().toLowerCase() === 'net income')?.amount ?? 0,
        subsections: netGroups.subsections,
        standalone: netGroups.standalone,
      },
    ]

    return sections
  }, [makeSubsections, profitLossQuery.data?.kpis.gross_profit, profitLossQuery.data?.lines])

  const toggleProfitLossSection = (key: string) => {
    setCollapsedProfitLossSections((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }))
  }

  const toggleProfitLossSubsection = (key: string) => {
    setCollapsedProfitLossSubsections((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }))
  }

  const balanceSheetGroupedLines = useMemo(
    () => groupLines(balanceSheetQuery.data?.lines),
    [balanceSheetQuery.data?.lines]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Accounting</h2>
          <p className="text-sm text-muted-foreground">
            Financial report snapshots from QuickBooks
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={periodMode} onValueChange={(value: 'month' | 'year') => setPeriodMode(value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Monthly</SelectItem>
            <SelectItem value="year">Annual</SelectItem>
          </SelectContent>
        </Select>
        {periodMode === 'month' ? (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={basis} onValueChange={(value: 'accrual' | 'cash') => setBasis(value)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="accrual">Accrual</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="profit-and-loss">
        <TabsList>
          <TabsTrigger value="profit-and-loss">Profit &amp; Loss</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="profit-and-loss" className="mt-4 space-y-4">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => backfillMonthlyCashProfitLossMutation.mutate()}
              disabled={syncProfitLossMutation.isPending || backfillMonthlyCashProfitLossMutation.isPending}
            >
              {backfillMonthlyCashProfitLossMutation.isPending
                ? `Refreshing ${cashBackfillProgress?.current || 0}/${cashBackfillProgress?.total || 0} (${cashBackfillProgress?.month || ''})`
                : 'Refresh Monthly Cash P&L (May 2023 - Last Month)'}
            </Button>
            <Button
              onClick={() => syncProfitLossMutation.mutate()}
              disabled={syncProfitLossMutation.isPending || backfillMonthlyCashProfitLossMutation.isPending}
            >
              {syncProfitLossMutation.isPending ? 'Refreshing...' : 'Refresh from QuickBooks'}
            </Button>
          </div>

          {profitLossQuery.isLoading ? (
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ) : profitLossQuery.error ? (
            <Card>
              <CardContent className="py-8 text-center text-destructive">
                {(profitLossQuery.error as Error).message}
              </CardContent>
            </Card>
          ) : !profitLossQuery.data ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No Profit &amp; Loss snapshot found for {periodLabel}. Click &quot;Refresh from QuickBooks&quot; to create one.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Income</CardDescription>
                    <CardTitle className="text-xl">{formatCurrency(profitLossQuery.data.kpis.total_income)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Gross Profit</CardDescription>
                    <CardTitle className="text-xl">{formatCurrency(profitLossQuery.data.kpis.gross_profit)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Net Income</CardDescription>
                    <CardTitle className="text-xl">{formatCurrency(profitLossQuery.data.kpis.net_income)}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Profit &amp; Loss Snapshot — {periodLabel}</CardTitle>
                  <CardDescription>
                    Basis: {basis.toUpperCase()} | Last synced: {new Date(profitLossQuery.data.snapshot.fetched_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {profitLossSections.map((section) => {
                      const sectionCollapsed = collapsedProfitLossSections[section.key] ?? false
                      return (
                        <div key={section.key}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-left"
                            onClick={() => toggleProfitLossSection(section.key)}
                          >
                            <span className="flex items-center gap-2 font-semibold">
                              {sectionCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              {section.title}
                            </span>
                            <span className="font-mono font-semibold">{formatCurrency(section.total)}</span>
                          </button>

                          {sectionCollapsed ? null : (
                            <div className="px-2 pb-2">
                              {section.subsections.map((subsection) => {
                                const subCollapsed = collapsedProfitLossSubsections[subsection.key] ?? false
                                return (
                                  <div key={subsection.key} className="border-b">
                                    <button
                                      type="button"
                                      className="flex w-full items-center justify-between px-3 py-2 text-left"
                                      onClick={() => toggleProfitLossSubsection(subsection.key)}
                                    >
                                      <span className="flex items-center gap-2 text-sm font-medium">
                                        {subCollapsed ? (
                                          <ChevronRight className="h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4" />
                                        )}
                                        {subsection.title}
                                      </span>
                                      <span className="font-mono text-sm">{formatCurrency(subsection.total)}</span>
                                    </button>
                                    {subCollapsed ? null : (
                                      <Table>
                                        <TableBody>
                                          {subsection.children.map((line) => (
                                            <TableRow key={`${subsection.key}-${line.sort_order}-${line.account_name}`}>
                                              <TableCell style={{ paddingLeft: `${Math.min(line.depth * 12, 48)}px` }}>
                                                {line.account_name}
                                              </TableCell>
                                              <TableCell className="text-right font-mono">
                                                {formatCurrency(line.amount)}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    )}
                                  </div>
                                )
                              })}

                              {section.standalone.length > 0 && (
                                <Table>
                                  <TableBody>
                                    {section.standalone.map((line) => (
                                      <TableRow key={`${section.key}-${line.sort_order}-${line.account_name}`}>
                                        <TableCell
                                          className={line.is_total ? 'font-semibold' : ''}
                                          style={{ paddingLeft: `${Math.min(line.depth * 12, 48)}px` }}
                                        >
                                          {line.account_name}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono ${line.is_total ? 'font-semibold' : ''}`}>
                                          {formatCurrency(line.amount)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="balance-sheet" className="mt-4 space-y-4">
          <div className="flex items-center justify-end">
            <Button onClick={() => syncBalanceSheetMutation.mutate()} disabled={syncBalanceSheetMutation.isPending}>
              {syncBalanceSheetMutation.isPending ? 'Refreshing...' : 'Refresh from QuickBooks'}
            </Button>
          </div>

          {balanceSheetQuery.isLoading ? (
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ) : balanceSheetQuery.error ? (
            <Card>
              <CardContent className="py-8 text-center text-destructive">
                {(balanceSheetQuery.error as Error).message}
              </CardContent>
            </Card>
          ) : !balanceSheetQuery.data ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No Balance Sheet snapshot found for {periodLabel}. Click &quot;Refresh from QuickBooks&quot; to create one.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Assets</CardDescription>
                    <CardTitle className="text-xl">{formatCurrency(balanceSheetQuery.data.kpis.total_assets)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Liabilities</CardDescription>
                    <CardTitle className="text-xl">{formatCurrency(balanceSheetQuery.data.kpis.total_liabilities)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Equity</CardDescription>
                    <CardTitle className="text-xl">{formatCurrency(balanceSheetQuery.data.kpis.total_equity)}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Balance Sheet Snapshot — {periodLabel}</CardTitle>
                  <CardDescription>
                    As of {balanceSheetQuery.data.snapshot.period_end} | Basis: {basis.toUpperCase()} | Last synced: {new Date(balanceSheetQuery.data.snapshot.fetched_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category / Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balanceSheetGroupedLines.map(([section, lines]) => (
                        <tr key={section}>
                          <td colSpan={2} className="p-0">
                            <div className="border-t">
                              <div className="bg-muted/30 px-4 py-2 text-sm font-semibold">{section}</div>
                              <Table>
                                <TableBody>
                                  {lines.map((line) => (
                                    <TableRow key={`${section}-${line.sort_order}-${line.account_name}`}>
                                      <TableCell
                                        className={line.is_total ? 'font-semibold' : ''}
                                        style={{ paddingLeft: `${Math.min(line.depth * 12, 48)}px` }}
                                      >
                                        {line.account_name}
                                      </TableCell>
                                      <TableCell className={`font-mono text-right ${line.is_total ? 'font-semibold' : ''}`}>
                                        {formatCurrency(line.amount)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
