'use client'

import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type SortField = 'vendor' | 'date' | 'amount' | 'project'
type SortDirection = 'asc' | 'desc'
type ContractType = 'fixed_monthly' | 'fixed_total' | 'hourly'
type ContractStatus = 'draft' | 'active' | 'on_hold' | 'closed' | 'cancelled'

type ContractLaborEntry = {
  id: number
  vendor_name: string | null
  expense_date: string | null
  description: string | null
  fee_amount: number | null
  project_number: string | null
  subcontract_contract_id: number | null
}

type ContractRow = {
  id: number
  contract_number: string | null
  project_id: number | null
  project_number: string | null
  phase_name: string | null
  vendor_name: string
  description: string | null
  contract_type: ContractType
  payment_cadence: string | null
  original_amount: number
  monthly_amount: number | null
  hourly_cost_rate: number | null
  planned_monthly_hours: number | null
  start_date: string | null
  end_date: string | null
  status: ContractStatus
  term_notes: string | null
  created_at: string
}

type NewContractForm = {
  contract_number: string
  vendor_name: string
  project_number: string
  phase_name: string
  contract_type: ContractType
  payment_cadence: string
  original_amount: string
  monthly_amount: string
  hourly_cost_rate: string
  planned_monthly_hours: string
  start_date: string
  end_date: string
  status: ContractStatus
  description: string
  term_notes: string
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string) {
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const m = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(m)) return month
  return new Date(year, m - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
}

function toMonth(dateValue: string | null | undefined) {
  if (!dateValue || dateValue.length < 7) return null
  return dateValue.slice(0, 7)
}

function monthInRange(month: string, startMonth: string | null, endMonth: string | null) {
  if (startMonth && month < startMonth) return false
  if (endMonth && month > endMonth) return false
  return true
}

export default function ContractLaborPage() {
  const supabase = createClient()
  const currentMonth = monthKey(new Date())
  const [activeTab, setActiveTab] = useState('contracts')
  const [isSavingContract, setIsSavingContract] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [scheduleYear, setScheduleYear] = useState(String(new Date().getFullYear()))
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({})
  const [newContract, setNewContract] = useState<NewContractForm>({
    contract_number: '',
    vendor_name: '',
    project_number: '',
    phase_name: '',
    contract_type: 'fixed_monthly',
    payment_cadence: 'monthly',
    original_amount: '',
    monthly_amount: '',
    hourly_cost_rate: '',
    planned_monthly_hours: '',
    start_date: '',
    end_date: '',
    status: 'active',
    description: '',
    term_notes: '',
  })

  const { data: labor, isLoading } = useQuery({
    queryKey: ['contract-labor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_expenses' as never)
        .select('id, vendor_name, expense_date, description, fee_amount, project_number, subcontract_contract_id')
        .eq('source_entity_type' as never, 'contract_labor' as never)
        .eq('is_reimbursable' as never, false as never)
        .neq('source_active' as never, false as never)
        .order('expense_date', { ascending: false })
      if (error) throw error
      return (data || []) as ContractLaborEntry[]
    },
  })

  const { data: contracts, isLoading: loadingContracts, refetch: refetchContracts } = useQuery({
    queryKey: ['subcontract-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcontract_contracts' as never)
        .select(
          'id, contract_number, project_id, project_number, phase_name, vendor_name, description, contract_type, payment_cadence, original_amount, monthly_amount, hourly_cost_rate, planned_monthly_hours, start_date, end_date, status, term_notes, created_at'
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as ContractRow[]
    },
  })

  const { data: projects } = useQuery({
    queryKey: ['contract-labor-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects' as never)
        .select('id, project_number, name')
        .order('project_number')
      if (error) throw error
      return data as { id: number; project_number: string; name: string | null }[]
    },
  })

  const { data: projectPhases } = useQuery({
    queryKey: ['contract-labor-project-phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_contracts_view' as never)
        .select('project_number, phase_name, phase_code')
        .order('project_number' as never, { ascending: true })
        .order('phase_code' as never, { ascending: true })
      if (error) throw error
      return (data || []) as Array<{ project_number: string; phase_name: string; phase_code: string }>
    },
  })

  const { data: qboContractLaborByMonth } = useQuery({
    queryKey: ['contract-labor-qbo-pnl-monthly'],
    queryFn: async () => {
      const { data: snapshots, error: snapshotError } = await supabase
        .from('accounting_snapshots' as never)
        .select('id, period_start, fetched_at')
        .eq('report_type' as never, 'profit_and_loss' as never)
        .eq('basis' as never, 'cash' as never)
        .gte('period_start' as never, '2023-05-01' as never)
        .order('fetched_at' as never, { ascending: false })
      if (snapshotError) throw snapshotError

      const snapshotByMonth = new Map<string, { id: number }>()
      ;((snapshots as Array<{ id: number; period_start: string }> | null) || []).forEach((row) => {
        const month = (row.period_start || '').slice(0, 7)
        if (!month) return
        if (!snapshotByMonth.has(month)) snapshotByMonth.set(month, { id: row.id })
      })

      const snapshotIds = Array.from(snapshotByMonth.values()).map((row) => row.id)
      if (!snapshotIds.length) return {} as Record<string, number>

      const { data: lines, error: lineError } = await supabase
        .from('accounting_snapshot_lines' as never)
        .select('snapshot_id, account_name, amount, is_total')
        .in('snapshot_id' as never, snapshotIds as never)
      if (lineError) throw lineError

      const monthBySnapshotId = new Map<number, string>()
      snapshotByMonth.forEach((row, month) => monthBySnapshotId.set(row.id, month))
      const byMonth: Record<string, number> = {}
      ;((lines as Array<{ snapshot_id: number; account_name: string; amount: number | null; is_total: boolean | null }> | null) || [])
        .forEach((line) => {
          const month = monthBySnapshotId.get(line.snapshot_id)
          if (!month) return
          const accountName = (line.account_name || '').trim().toLowerCase()
          const isContractLabor = accountName.includes('contract labor') && !accountName.startsWith('total ')
          if (!isContractLabor) return
          if (line.is_total) return
          byMonth[month] = (byMonth[month] || 0) + (Number(line.amount) || 0)
        })
      return byMonth
    },
  })

  const vendors = useMemo(() => {
    const set = new Set<string>()
    ;(labor || []).forEach((entry) => {
      if (entry.vendor_name) set.add(entry.vendor_name)
    })
    return Array.from(set).sort()
  }, [labor])

  const projectNumbers = useMemo(() => {
    const set = new Set<string>()
    ;(projects || []).forEach((project) => {
      if (project.project_number) set.add(project.project_number)
    })
    return Array.from(set).sort()
  }, [projects])

  const projectNameByNumber = useMemo(() => {
    const map = new Map<string, string>()
    ;(projects || []).forEach((project) => {
      if (project.project_number && project.name) {
        map.set(project.project_number, project.name)
      }
    })
    return map
  }, [projects])

  const phaseOptionsForSelectedProject = useMemo(() => {
    if (!newContract.project_number || !projectPhases) return [] as string[]
    return Array.from(
      new Set(
        projectPhases
          .filter((row) => row.project_number === newContract.project_number)
          .map((row) => row.phase_name)
          .filter(Boolean)
      )
    )
  }, [newContract.project_number, projectPhases])

  const getEntryDateValue = (entry: ContractLaborEntry) =>
    entry.expense_date ? new Date(entry.expense_date) : null

  const filteredLabor = useMemo(() => {
    const list = labor || []
    return list.filter((entry) => {
      const matchesVendor = vendorFilter === 'all' || entry.vendor_name === vendorFilter
      if (!matchesVendor) return false

      const matchesProject = projectFilter === 'all' || entry.project_number === projectFilter
      if (!matchesProject) return false

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesText =
          (entry.vendor_name || '').toLowerCase().includes(query) ||
          (entry.description || '').toLowerCase().includes(query) ||
          (entry.project_number || '').toLowerCase().includes(query)
        if (!matchesText) return false
      }

      if (dateStart || dateEnd) {
        const entryDate = getEntryDateValue(entry)
        if (!entryDate) return false
        if (dateStart && entryDate < new Date(dateStart)) return false
        if (dateEnd) {
          const end = new Date(dateEnd)
          end.setHours(23, 59, 59, 999)
          if (entryDate > end) return false
        }
      }

      return true
    })
  }, [labor, vendorFilter, projectFilter, searchQuery, dateStart, dateEnd])

  const sortedLabor = useMemo(() => {
    const list = [...filteredLabor]
    list.sort((a, b) => {
      let aVal: string | number | Date | null = null
      let bVal: string | number | Date | null = null
      switch (sortField) {
        case 'vendor':
          aVal = a.vendor_name
          bVal = b.vendor_name
          break
        case 'date':
          aVal = getEntryDateValue(a)
          bVal = getEntryDateValue(b)
          break
        case 'amount':
          aVal = Number(a.fee_amount) || 0
          bVal = Number(b.fee_amount) || 0
          break
        case 'project':
          aVal = a.project_number || ''
          bVal = b.project_number || ''
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
    return list
  }, [filteredLabor, sortField, sortDirection])

  const contractsWithMetrics = useMemo(() => {
    const rows = contracts || []
    const actualRows = labor || []

    const byContractMonth = new Map<string, number>()
    const paidByContractId = new Map<number, number>()

    const contractMatch = (entry: ContractLaborEntry, contract: ContractRow) => {
      const entryMonth = toMonth(entry.expense_date)
      const startMonth = toMonth(contract.start_date)
      const endMonth = toMonth(contract.end_date)
      const vendorMatches =
        (entry.vendor_name || '').trim().toLowerCase() === (contract.vendor_name || '').trim().toLowerCase()
      const projectMatches =
        (entry.project_number || '').trim() === (contract.project_number || '').trim()
      if (!vendorMatches || !projectMatches) return false
      if (!entryMonth) return false
      return monthInRange(entryMonth, startMonth, endMonth)
    }

    rows.forEach((contract) => {
      const linkedOrMatched = actualRows.filter((entry) => {
        if (entry.subcontract_contract_id && entry.subcontract_contract_id === contract.id) return true
        if (entry.subcontract_contract_id) return false
        return contractMatch(entry, contract)
      })

      linkedOrMatched.forEach((entry) => {
        const month = toMonth(entry.expense_date)
        const amount = Number(entry.fee_amount) || 0
        paidByContractId.set(contract.id, (paidByContractId.get(contract.id) || 0) + amount)
        if (month) {
          byContractMonth.set(`${contract.id}::${month}`, (byContractMonth.get(`${contract.id}::${month}`) || 0) + amount)
        }
      })
    })

    return rows.map((contract) => {
      const paid = paidByContractId.get(contract.id) || 0
      const totalAmount = Number(contract.original_amount) || 0
      const remaining = Math.max(0, totalAmount - paid)
      return { ...contract, paidToDate: paid, remaining, byMonth: byContractMonth }
    })
  }, [contracts, labor])

  const activeContracts = useMemo(
    () => contractsWithMetrics.filter((row) => ['draft', 'active', 'on_hold'].includes(row.status)),
    [contractsWithMetrics]
  )

  const scheduleGroups = useMemo(() => {
    const groups = new Map<string, typeof activeContracts>()
    const sortedContracts = [...activeContracts].sort((a, b) => {
      const projectA = a.project_number || 'Unassigned'
      const projectB = b.project_number || 'Unassigned'
      if (projectA < projectB) return -1
      if (projectA > projectB) return 1
      const contractA = a.contract_number || `C-${a.id}`
      const contractB = b.contract_number || `C-${b.id}`
      if (contractA < contractB) return -1
      if (contractA > contractB) return 1
      return 0
    })

    sortedContracts.forEach((contract) => {
      const projectKey = contract.project_number || 'Unassigned'
      groups.set(projectKey, [...(groups.get(projectKey) || []), contract])
    })

    return Array.from(groups.entries()).map(([projectNumber, contractsInProject]) => ({
      projectNumber,
      contracts: contractsInProject,
    }))
  }, [activeContracts])

  const scheduleYears = useMemo(() => {
    const years = new Set<number>()
    years.add(new Date().getFullYear())
    ;(contractsWithMetrics || []).forEach((row) => {
      if (row.start_date) years.add(new Date(row.start_date).getFullYear())
      if (row.end_date) years.add(new Date(row.end_date).getFullYear())
    })
    ;(labor || []).forEach((row) => {
      if (row.expense_date) years.add(new Date(row.expense_date).getFullYear())
    })
    return Array.from(years).sort((a, b) => a - b)
  }, [contractsWithMetrics, labor])

  const scheduleMonths = useMemo(() => {
    const year = Number(scheduleYear)
    return Array.from({ length: 12 }, (_, index) => {
      const d = new Date(year, index, 1)
      return monthKey(d)
    })
  }, [scheduleYear])

  const allFutureMonthsForProjection = useMemo(() => {
    const start = new Date(`${currentMonth}-01T00:00:00`)
    const maxContractEnd = contractsWithMetrics.reduce((latest, row) => {
      if (!row.end_date) return latest
      const d = new Date(row.end_date)
      return d > latest ? d : latest
    }, new Date(start.getFullYear(), start.getMonth() + 24, 1))
    const months: string[] = []
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const end = new Date(maxContractEnd.getFullYear(), maxContractEnd.getMonth(), 1)
    while (cursor <= end) {
      months.push(monthKey(cursor))
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
    return months
  }, [contractsWithMetrics, currentMonth])

  const projectedByContractMonth = useMemo(() => {
    const projection = new Map<string, number>()

    const pushProjection = (contractId: number, month: string, amount: number) => {
      if (amount <= 0) return
      projection.set(`${contractId}::${month}`, amount)
    }

    contractsWithMetrics.forEach((contract) => {
      if (!['draft', 'active', 'on_hold'].includes(contract.status)) return
      const startMonth = toMonth(contract.start_date)
      const endMonth = toMonth(contract.end_date)
      const futureMonths = allFutureMonthsForProjection.filter((month) =>
        monthInRange(month, startMonth, endMonth)
      )
      if (!futureMonths.length) return

      if (contract.contract_type === 'fixed_monthly') {
        const monthly = Number(contract.monthly_amount) || 0
        futureMonths.forEach((month) => pushProjection(contract.id, month, monthly))
        return
      }

      if (contract.contract_type === 'hourly') {
        const rate = Number(contract.hourly_cost_rate) || 0
        const hours = Number(contract.planned_monthly_hours) || 0
        const amount = rate * hours
        futureMonths.forEach((month) => pushProjection(contract.id, month, amount))
        return
      }

      const remaining = Math.max(0, Number(contract.remaining) || 0)
      if (remaining <= 0) return
      const perMonth = futureMonths.length ? remaining / futureMonths.length : 0
      futureMonths.forEach((month) => pushProjection(contract.id, month, perMonth))
    })

    return projection
  }, [contractsWithMetrics, allFutureMonthsForProjection])

  const actualByMonth = useMemo(() => {
    const map = new Map<string, number>()
    ;(labor || []).forEach((entry) => {
      const month = toMonth(entry.expense_date)
      if (!month) return
      map.set(month, (map.get(month) || 0) + (Number(entry.fee_amount) || 0))
    })
    return map
  }, [labor])

  const projectedByMonth = useMemo(() => {
    const map = new Map<string, number>()
    projectedByContractMonth.forEach((amount, key) => {
      const month = key.split('::')[1]
      map.set(month, (map.get(month) || 0) + amount)
    })
    return map
  }, [projectedByContractMonth])

  const handleCreateContract = async () => {
    if (!newContract.vendor_name.trim()) return toast.error('Vendor is required')
    if (!newContract.project_number.trim()) return toast.error('Project number is required')
    if (!newContract.phase_name.trim()) return toast.error('Phase is required')
    if (!newContract.contract_number.trim()) return toast.error('Contract number is required')

    setIsSavingContract(true)
    try {
      const project = (projects || []).find((row) => row.project_number === newContract.project_number)
      const payload = {
        contract_number: newContract.contract_number.trim(),
        project_id: project?.id || null,
        project_number: newContract.project_number.trim(),
        phase_name: newContract.phase_name.trim(),
        vendor_name: newContract.vendor_name.trim(),
        description: newContract.description.trim() || null,
        contract_type: newContract.contract_type,
        payment_cadence: newContract.payment_cadence || null,
        original_amount: Number(newContract.original_amount) || 0,
        monthly_amount: newContract.contract_type === 'fixed_monthly' ? Number(newContract.monthly_amount) || 0 : null,
        hourly_cost_rate: newContract.contract_type === 'hourly' ? Number(newContract.hourly_cost_rate) || 0 : null,
        planned_monthly_hours: newContract.contract_type === 'hourly' ? Number(newContract.planned_monthly_hours) || 0 : null,
        start_date: newContract.start_date || null,
        end_date: newContract.end_date || null,
        status: newContract.status,
        term_notes: newContract.term_notes.trim() || null,
      }
      const { error } = await supabase.from('subcontract_contracts' as never).insert(payload as never)
      if (error) throw error

      toast.success('Contract saved')
      setNewContract({
        contract_number: '',
        vendor_name: newContract.vendor_name,
        project_number: '',
        phase_name: '',
        contract_type: 'fixed_monthly',
        payment_cadence: 'monthly',
        original_amount: '',
        monthly_amount: '',
        hourly_cost_rate: '',
        planned_monthly_hours: '',
        start_date: '',
        end_date: '',
        status: 'active',
        description: '',
        term_notes: '',
      })
      refetchContracts()
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save contract')
    } finally {
      setIsSavingContract(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const renderSortButton = (field: SortField, children: React.ReactNode) => {
    const isActive = sortField === field
    return (
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {children}
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

  const toggleProjectCollapsed = (projectKey: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [projectKey]: !prev[projectKey] }))
  }

  const collapseAllProjects = () => {
    const nextState: Record<string, boolean> = {}
    scheduleGroups.forEach((group) => {
      nextState[group.projectNumber] = true
    })
    setCollapsedProjects(nextState)
  }

  const expandAllProjects = () => {
    const nextState: Record<string, boolean> = {}
    scheduleGroups.forEach((group) => {
      nextState[group.projectNumber] = false
    })
    setCollapsedProjects(nextState)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Contract Labor</h2>
        <p className="text-sm text-muted-foreground">
          Contract registry, monthly schedule, synced actuals, and reconciliation
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="actuals">Actuals</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="contracts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Active Contracts</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{activeContracts.length}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Paid To Date</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatCurrency(activeContracts.reduce((sum, row) => sum + row.paidToDate, 0))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Remaining (Fixed Total)</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatCurrency(
                  activeContracts
                    .filter((row) => row.contract_type === 'fixed_total')
                    .reduce((sum, row) => sum + row.remaining, 0)
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Commitments</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatCurrency(activeContracts.reduce((sum, row) => sum + (Number(row.original_amount) || 0), 0))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Add Contract</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Contract #</Label>
                  <Input
                    value={newContract.contract_number}
                    onChange={(event) => setNewContract((prev) => ({ ...prev, contract_number: event.target.value }))}
                    placeholder="PI-23-01-MW"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Input
                    value={newContract.vendor_name}
                    onChange={(event) => setNewContract((prev) => ({ ...prev, vendor_name: event.target.value }))}
                    placeholder="Morgan Wilson"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select
                    value={newContract.project_number || ''}
                    onValueChange={(value) =>
                      setNewContract((prev) => ({ ...prev, project_number: value, phase_name: '' }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {(projectNumbers || []).map((projectNumber) => (
                        <SelectItem key={projectNumber} value={projectNumber}>
                          {projectNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phase</Label>
                  <Select
                    value={newContract.phase_name || ''}
                    onValueChange={(value) => setNewContract((prev) => ({ ...prev, phase_name: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select phase" />
                    </SelectTrigger>
                    <SelectContent>
                      {phaseOptionsForSelectedProject.map((phaseName) => (
                        <SelectItem key={phaseName} value={phaseName}>
                          {phaseName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Contract Type</Label>
                  <Select
                    value={newContract.contract_type}
                    onValueChange={(value: ContractType) => setNewContract((prev) => ({ ...prev, contract_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_monthly">Fixed Monthly</SelectItem>
                      <SelectItem value="fixed_total">Fixed Total</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={newContract.status}
                    onValueChange={(value: ContractStatus) => setNewContract((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Input
                    value={newContract.payment_cadence}
                    onChange={(event) => setNewContract((prev) => ({ ...prev, payment_cadence: event.target.value }))}
                    placeholder="monthly / milestone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contract Amount</Label>
                  <Input
                    type="number"
                    value={newContract.original_amount}
                    onChange={(event) => setNewContract((prev) => ({ ...prev, original_amount: event.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Monthly Amount</Label>
                  <Input
                    type="number"
                    value={newContract.monthly_amount}
                    onChange={(event) => setNewContract((prev) => ({ ...prev, monthly_amount: event.target.value }))}
                    placeholder="750.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hourly Cost Rate</Label>
                  <Input
                    type="number"
                    value={newContract.hourly_cost_rate}
                    onChange={(event) => setNewContract((prev) => ({ ...prev, hourly_cost_rate: event.target.value }))}
                    placeholder="75.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Planned Monthly Hours</Label>
                  <Input
                    type="number"
                    value={newContract.planned_monthly_hours}
                    onChange={(event) =>
                      setNewContract((prev) => ({ ...prev, planned_monthly_hours: event.target.value }))
                    }
                    placeholder="20"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newContract.description}
                    onChange={(event) => setNewContract((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Private inspection services"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={newContract.start_date}
                    onChange={(event) => setNewContract((prev) => ({ ...prev, start_date: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={newContract.end_date}
                    onChange={(event) => setNewContract((prev) => ({ ...prev, end_date: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Term Notes</Label>
                  <Textarea
                    value={newContract.term_notes}
                    onChange={(event) => setNewContract((prev) => ({ ...prev, term_notes: event.target.value }))}
                    placeholder="Monthly through construction period..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void handleCreateContract()} disabled={isSavingContract}>
                  {isSavingContract ? 'Saving...' : 'Save Contract'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Contracts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingContracts ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractsWithMetrics.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono">{row.contract_number || `C-${row.id}`}</TableCell>
                        <TableCell>{row.vendor_name}</TableCell>
                        <TableCell className="font-mono">{row.project_number || '-'}</TableCell>
                        <TableCell>{row.phase_name || '-'}</TableCell>
                        <TableCell>{row.contract_type.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(row.original_amount) || 0)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(row.paidToDate)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {row.contract_type === 'hourly' ? 'N/A' : formatCurrency(row.remaining)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {contractsWithMetrics.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                          No contracts yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Contract Labor Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 pb-3">
                <span className="text-sm text-muted-foreground">Year</span>
                <Select value={scheduleYear} onValueChange={setScheduleYear}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  Historical months use synced actuals. Current/future use calculated projections from contract terms.
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={expandAllProjects}>
                    Expand All
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={collapseAllProjects}>
                    Collapse All
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[280px]">Project / Contract</TableHead>
                      {scheduleMonths.map((month) => (
                        <TableHead key={month} className="text-right min-w-[110px]">
                          {monthLabel(month)}
                        </TableHead>
                      ))}
                      <TableHead className="text-right min-w-[120px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduleGroups.map((group) => {
                      const projectKey = group.projectNumber
                      const isCollapsed = Boolean(collapsedProjects[projectKey])
                      const projectTotal = scheduleMonths.reduce((sum, month) => {
                        const monthTotal = group.contracts.reduce((contractSum, contract) => {
                          const actual = contract.byMonth.get(`${contract.id}::${month}`) || 0
                          const projected =
                            month >= currentMonth
                              ? projectedByContractMonth.get(`${contract.id}::${month}`) || 0
                              : 0
                          return contractSum + (month < currentMonth ? actual : projected)
                        }, 0)
                        return sum + monthTotal
                      }, 0)

                      return (
                        <Fragment key={`group-${group.projectNumber}`}>
                          <TableRow key={`project-${group.projectNumber}`} className="bg-muted/30">
                            <TableCell className="font-semibold">
                              <button
                                type="button"
                                onClick={() => toggleProjectCollapsed(projectKey)}
                                className="inline-flex items-center gap-2 hover:text-foreground"
                                aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.projectNumber}`}
                              >
                                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span>
                                  {group.projectNumber}
                                  {projectNameByNumber.get(group.projectNumber)
                                    ? ` - ${projectNameByNumber.get(group.projectNumber)}`
                                    : ''}
                                </span>
                              </button>
                            </TableCell>
                            {scheduleMonths.map((month) => {
                              const monthTotal = group.contracts.reduce((contractSum, contract) => {
                                const actual = contract.byMonth.get(`${contract.id}::${month}`) || 0
                                const projected =
                                  month >= currentMonth
                                    ? projectedByContractMonth.get(`${contract.id}::${month}`) || 0
                                    : 0
                                return contractSum + (month < currentMonth ? actual : projected)
                              }, 0)
                              return (
                                <TableCell key={`project-${group.projectNumber}-${month}`} className="text-right font-mono font-semibold">
                                  {monthTotal === 0 ? '-' : formatCurrency(monthTotal)}
                                </TableCell>
                              )
                            })}
                            <TableCell className="text-right font-mono font-semibold">
                              {formatCurrency(projectTotal)}
                            </TableCell>
                          </TableRow>

                          {!isCollapsed && group.contracts.map((contract) => {
                            const rowTotal = scheduleMonths.reduce((sum, month) => {
                              const actual = contract.byMonth.get(`${contract.id}::${month}`) || 0
                              const projected =
                                month >= currentMonth
                                  ? projectedByContractMonth.get(`${contract.id}::${month}`) || 0
                                  : 0
                              return sum + (month < currentMonth ? actual : projected)
                            }, 0)

                            return (
                              <TableRow key={`schedule-${contract.id}`}>
                                <TableCell>
                                  <div className="font-medium pl-4">{contract.contract_number || `C-${contract.id}`}</div>
                                  <div className="text-xs text-muted-foreground pl-4">
                                    {contract.vendor_name} | {contract.phase_name || '-'}
                                  </div>
                                </TableCell>
                                {scheduleMonths.map((month) => {
                                  const actual = contract.byMonth.get(`${contract.id}::${month}`) || 0
                                  const projected =
                                    month >= currentMonth
                                      ? projectedByContractMonth.get(`${contract.id}::${month}`) || 0
                                      : 0
                                  const value = month < currentMonth ? actual : projected
                                  return (
                                    <TableCell key={`${contract.id}::${month}`} className="text-right font-mono">
                                      {value === 0 ? '-' : formatCurrency(value)}
                                    </TableCell>
                                  )
                                })}
                                <TableCell className="text-right font-mono">{formatCurrency(rowTotal)}</TableCell>
                              </TableRow>
                            )
                          })}
                        </Fragment>
                      )
                    })}

                    <TableRow className="bg-muted/20 font-semibold">
                      <TableCell>Total Contract Labor</TableCell>
                      {scheduleMonths.map((month) => {
                        const actual = actualByMonth.get(month) || 0
                        const projected = month >= currentMonth ? (projectedByMonth.get(month) || 0) : 0
                        const value = month < currentMonth ? actual : projected
                        return (
                          <TableCell key={`total-${month}`} className="text-right font-mono">
                            {formatCurrency(value)}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right font-mono">
                        {formatCurrency(
                          scheduleMonths.reduce((sum, month) => {
                            const actual = actualByMonth.get(month) || 0
                            const projected = month >= currentMonth ? (projectedByMonth.get(month) || 0) : 0
                            return sum + (month < currentMonth ? actual : projected)
                          }, 0)
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actuals" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-end gap-4 p-4 border-b">
                <div className="flex-1 min-w-[200px] max-w-[320px]">
                  <Input
                    placeholder="Search vendor, description, project..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
                <div className="min-w-[180px]">
                  <Select value={vendorFilter} onValueChange={setVendorFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All vendors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All vendors</SelectItem>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor} value={vendor}>
                          {vendor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[180px]">
                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All projects</SelectItem>
                      {projectNumbers.map((projectNumber) => (
                        <SelectItem key={projectNumber} value={projectNumber}>
                          {projectNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={(event) => setDateStart(event.target.value)}
                  />
                </div>
                <div className="min-w-[160px]">
                  <Input
                    type="date"
                    value={dateEnd}
                    onChange={(event) => setDateEnd(event.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('')
                    setVendorFilter('all')
                    setProjectFilter('all')
                    setDateStart('')
                    setDateEnd('')
                  }}
                >
                  Reset
                </Button>
              </div>
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
                      <TableHead>
                        {renderSortButton('vendor', 'Vendor')}
                      </TableHead>
                      <TableHead>
                        {renderSortButton('date', 'Date')}
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground">Description</TableHead>
                      <TableHead className="text-right text-xs text-muted-foreground">Amount</TableHead>
                      <TableHead>
                        {renderSortButton('project', 'Project Number')}
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground">Contract Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedLabor.map((entry) => {
                      const linkedContract = contractsWithMetrics.find((row) => row.id === entry.subcontract_contract_id)
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.vendor_name}</TableCell>
                          <TableCell>
                            {entry.expense_date ? formatDate(entry.expense_date) : '—'}
                          </TableCell>
                          <TableCell>{entry.description || '—'}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(Number(entry.fee_amount) || 0)}
                          </TableCell>
                          <TableCell className="font-mono">{entry.project_number || '—'}</TableCell>
                          <TableCell className="text-xs">
                            {linkedContract ? (linkedContract.contract_number || `C-${linkedContract.id}`) : 'Unlinked'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {sortedLabor.length > 0 && (
                      <TableRow className="font-medium bg-muted/20">
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(
                            sortedLabor.reduce((sum, entry) => sum + (Number(entry.fee_amount) || 0), 0)
                          )}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    )}
                    {sortedLabor.length === 0 && (
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
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historical Reconciliation (QBO P&amp;L vs Synced Actuals)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">QBO Contract Labor (P&amp;L)</TableHead>
                    <TableHead className="text-right">Synced Actual Contract Labor</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduleMonths.map((month) => {
                    const qbo = Number(qboContractLaborByMonth?.[month] || 0)
                    const actual = Number(actualByMonth.get(month) || 0)
                    const delta = actual - qbo
                    const isHistorical = month < currentMonth
                    return (
                      <TableRow key={`recon-${month}`}>
                        <TableCell>{monthLabel(month)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(qbo)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(actual)}</TableCell>
                        <TableCell
                          className={`text-right font-mono ${delta < 0 ? 'text-red-600' : delta > 0 ? 'text-amber-600' : ''}`}
                        >
                          {isHistorical ? formatCurrency(delta) : '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

