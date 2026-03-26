'use client'
import { usePermissionRedirect } from '@/lib/auth/use-permission-redirect'
/* eslint-disable react-hooks/static-components */

import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
import { Plus, Search, ChevronDown, ChevronRight, Trash2, Pencil, ArrowUpDown, ChevronUp } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import type { Tables } from '@/lib/types/database'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
} from 'recharts'

type ProposalWithPhases = Tables<'proposals'> & {
  proposal_phases: Tables<'proposal_phases'>[]
}

export default function ProposalsPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedProposals, setExpandedProposals] = useState<Set<number>>(new Set())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProposal, setEditingProposal] = useState<ProposalWithPhases | null>(null)
  const [proposedGranularity, setProposedGranularity] = useState<'year' | 'quarter' | 'month'>('quarter')
  const [executedGranularity, setExecutedGranularity] = useState<'year' | 'quarter' | 'month'>('quarter')
  const [sortField, setSortField] = useState<
    | 'proposal_number'
    | 'proposal_name'
    | 'project_number'
    | 'submitted'
    | 'executed_date'
    | 'bse_amount'
    | 'status'
  >('proposal_number')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [formData, setFormData] = useState({
    proposalNumber: '',
    proposalName: '',
    submittedDate: '',
    phases: [
      {
        phaseCode: '',
        phaseName: '',
        billingType: 'L' as 'L' | 'H',
        amount: '',
      },
    ],
  })

  const { data: proposals, isLoading } = useQuery({
    queryKey: ['proposals-with-phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select(`
          *,
          proposal_phases (*)
        `)
        .order('date_submitted', { ascending: false })
      if (error) throw error
      return data as ProposalWithPhases[]
    },
  })

  const phaseOptions = [
    'Agency Due Diligence',
    'Code Landscape Design',
    'Electrical & Telecom Support',
    'Engineering Plan Preparation',
    'Final Certs and Construction Obs.',
    'Hourly Support',
    'Lift Station and Onsite Force Main',
    'Maps/Site Plans',
    'Mass Grading Plan',
    'MDP/PUD VSC',
    'Offsite Utility Design',
    'Permitting',
    'Preliminary Analysis',
    'Preliminary Design',
    'Preliminary Plat',
    'Preliminary Site Planning',
    'Preliminary Site Plan Revisions',
    'Private Inspection',
    'Private Lift Station Design',
    'Project Meetings',
    'Rezoning Support',
    'Stormwater Analysis',
    'Survey, Topo, and SUE',
    'Turn Lane Design',
    'Value Engineering Review',
  ]

  const createProposalMutation = useMutation({
    mutationFn: async () => {
      const trimmedNumber = formData.proposalNumber.trim()
      const trimmedName = formData.proposalName.trim()
      if (!trimmedNumber) throw new Error('Proposal number is required')
      if (!trimmedName) throw new Error('Proposal name is required')
      if (!formData.submittedDate) throw new Error('Submitted date is required')

      const parsedPhases = formData.phases
        .map((phase) => ({
          phase_code: phase.phaseCode.trim(),
          phase_name: phase.phaseName.trim(),
          billing_type: phase.billingType,
          amount: Number(phase.amount.replace(/[^0-9.-]/g, '')) || 0,
        }))
        .filter((phase) => phase.phase_code || phase.phase_name || phase.amount > 0)

      if (parsedPhases.length === 0) {
        throw new Error('At least one phase is required')
      }

      const totalAmount = parsedPhases.reduce((sum, phase) => sum + phase.amount, 0)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: proposal, error } = await (supabase as any)
        .from('proposals')
        .insert({
          proposal_number: trimmedNumber,
          name: trimmedName,
          date_submitted: formData.submittedDate,
          total_amount: totalAmount,
          bse_amount: totalAmount,
        })
        .select('id')
        .single()

      if (error) throw error

      const phaseRows = parsedPhases.map((phase) => ({
        proposal_id: proposal.id,
        phase_code: phase.phase_code,
        phase_name: phase.phase_name,
        billing_type: phase.billing_type,
        amount: phase.amount,
      }))

      const { error: phaseError } = await supabase
        .from('proposal_phases')
        .insert(phaseRows as never)
      if (phaseError) throw phaseError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals-with-phases'] })
      toast.success('Proposal created')
      setIsDialogOpen(false)
      setEditingProposal(null)
      setFormData({
        proposalNumber: '',
        proposalName: '',
        submittedDate: '',
        phases: [
          {
            phaseCode: '',
            phaseName: '',
            billingType: 'L',
            amount: '',
          },
        ],
      })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create proposal')
    },
  })

  const updateProposalMutation = useMutation({
    mutationFn: async () => {
      if (!editingProposal) throw new Error('No proposal selected')
      const trimmedNumber = formData.proposalNumber.trim()
      const trimmedName = formData.proposalName.trim()
      if (!trimmedNumber) throw new Error('Proposal number is required')
      if (!trimmedName) throw new Error('Proposal name is required')
      if (!formData.submittedDate) throw new Error('Submitted date is required')

      const parsedPhases = formData.phases
        .map((phase) => ({
          phase_code: phase.phaseCode.trim(),
          phase_name: phase.phaseName.trim(),
          billing_type: phase.billingType,
          amount: Number(phase.amount.replace(/[^0-9.-]/g, '')) || 0,
        }))
        .filter((phase) => phase.phase_code || phase.phase_name || phase.amount > 0)

      if (parsedPhases.length === 0) {
        throw new Error('At least one phase is required')
      }

      const totalAmount = parsedPhases.reduce((sum, phase) => sum + phase.amount, 0)

      const { error } = await supabase
        .from('proposals')
        .update({
          proposal_number: trimmedNumber,
          name: trimmedName,
          date_submitted: formData.submittedDate,
          total_amount: totalAmount,
          bse_amount: totalAmount,
        } as never)
        .eq('id', editingProposal.id as never)
      if (error) throw error

      const { error: deleteError } = await supabase
        .from('proposal_phases')
        .delete()
        .eq('proposal_id', editingProposal.id as never)
      if (deleteError) throw deleteError

      const phaseRows = parsedPhases.map((phase) => ({
        proposal_id: editingProposal.id,
        phase_code: phase.phase_code,
        phase_name: phase.phase_name,
        billing_type: phase.billing_type,
        amount: phase.amount,
      }))

      const { error: phaseError } = await supabase
        .from('proposal_phases')
        .insert(phaseRows as never)
      if (phaseError) throw phaseError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals-with-phases'] })
      toast.success('Proposal updated')
      setIsDialogOpen(false)
      setEditingProposal(null)
      setFormData({
        proposalNumber: '',
        proposalName: '',
        submittedDate: '',
        phases: [
          {
            phaseCode: '',
            phaseName: '',
            billingType: 'L',
            amount: '',
          },
        ],
      })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update proposal')
    },
  })

  const deleteProposalMutation = useMutation({
    mutationFn: async (proposal: ProposalWithPhases) => {
      const { error: phaseError } = await supabase
        .from('proposal_phases')
        .delete()
        .eq('proposal_id', proposal.id as never)
      if (phaseError) throw phaseError

      const { error } = await supabase
        .from('proposals')
        .delete()
        .eq('id', proposal.id as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals-with-phases'] })
      toast.success('Proposal deleted')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete proposal')
    },
  })

  const autoCloseMutation = useMutation({
    mutationFn: async (proposalId: number) => {
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'closed' } as never)
        .eq('id', proposalId as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals-with-phases'] })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update status')
    },
  })

  const updateExecutedDateMutation = useMutation({
    mutationFn: async ({ proposalId, date }: { proposalId: number; date: string | null }) => {
      const updates =
        date
          ? { date_executed: date, status: 'executed' }
          : { date_executed: null, status: 'pending' }
      const { error } = await supabase
        .from('proposals')
        .update(updates as never)
        .eq('id', proposalId as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals-with-phases'] })
      toast.success('Date executed updated')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update date executed')
    },
  })

  const openCreateDialog = () => {
    setEditingProposal(null)
    setFormData({
      proposalNumber: '',
      proposalName: '',
      submittedDate: '',
      phases: [
        {
          phaseCode: '',
          phaseName: '',
          billingType: 'L',
          amount: '',
        },
      ],
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (proposal: ProposalWithPhases) => {
    setEditingProposal(proposal)
    setFormData({
      proposalNumber: proposal.proposal_number || '',
      proposalName: proposal.name || '',
      submittedDate: proposal.date_submitted || '',
      phases: (proposal.proposal_phases || []).map((phase) => ({
        phaseCode: phase.phase_code || '',
        phaseName: phase.phase_name || '',
        billingType: phase.billing_type || 'L',
        amount: phase.amount !== null && phase.amount !== undefined
          ? formatCurrency(Number(phase.amount))
          : '',
      })),
    })
    setIsDialogOpen(true)
  }

  const handleSort = (
    field:
      | 'proposal_number'
      | 'proposal_name'
      | 'project_number'
      | 'submitted'
      | 'executed_date'
      | 'bse_amount'
      | 'status'
  ) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // eslint-disable-next-line react-hooks/static-components
  const SortButton = ({
    field,
    children,
  }: {
    field:
      | 'proposal_number'
      | 'proposal_name'
      | 'project_number'
      | 'submitted'
      | 'executed_date'
      | 'bse_amount'
      | 'status'
    children: React.ReactNode
  }) => {
    const isActive = sortField === field
    return (
      <button
        onClick={(event) => {
          event.stopPropagation()
          handleSort(field)
        }}
        className="flex items-center gap-1 text-sm font-medium text-foreground"
      >
        {children}
        {isActive ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    )
  }

  // Filter proposals
  const getComputedStatus = (proposal: ProposalWithPhases, now: Date) => {
    if (proposal.status === 'executed' || proposal.date_executed) return 'executed'
    const submittedDate = proposal.date_submitted ? new Date(proposal.date_submitted) : null
    const isOlderThanThreeMonths = submittedDate
      ? now.getTime() - submittedDate.getTime() > 90 * 24 * 60 * 60 * 1000
      : false
    if (proposal.status === 'closed' || isOlderThanThreeMonths) return 'closed'
    return 'pending'
  }

  const filteredProposals = useMemo(() => {
    if (!proposals) return []
    
    const now = new Date()
    proposals.forEach((proposal) => {
      const submittedDate = proposal.date_submitted ? new Date(proposal.date_submitted) : null
      const isOlderThanThreeMonths = submittedDate
        ? now.getTime() - submittedDate.getTime() > 90 * 24 * 60 * 60 * 1000
        : false
      if (!proposal.date_executed && isOlderThanThreeMonths && proposal.status !== 'closed') {
        autoCloseMutation.mutate(proposal.id)
      }
    })
    const filtered = proposals.filter(proposal => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesNumber = proposal.proposal_number?.toLowerCase().includes(query)
        const matchesName = proposal.name?.toLowerCase().includes(query)
        const matchesProject = proposal.project_number?.toLowerCase().includes(query)
        if (!matchesNumber && !matchesName && !matchesProject) return false
      }
      
      const computedStatus = getComputedStatus(proposal, now)

      // Status filter
      if (statusFilter !== 'all' && computedStatus !== statusFilter) return false
      
      return true
    })

    filtered.sort((a, b) => {
      if (sortField === 'bse_amount') {
        const aVal = Number(a.bse_amount) || 0
        const bVal = Number(b.bse_amount) || 0
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      if (sortField === 'submitted') {
        const aVal = a.date_submitted ? new Date(a.date_submitted).getTime() : 0
        const bVal = b.date_submitted ? new Date(b.date_submitted).getTime() : 0
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      if (sortField === 'executed_date') {
        const aVal = a.date_executed ? new Date(a.date_executed).getTime() : 0
        const bVal = b.date_executed ? new Date(b.date_executed).getTime() : 0
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      if (sortField === 'status') {
        const aVal = getComputedStatus(a, now)
        const bVal = getComputedStatus(b, now)
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      let aVal = ''
      let bVal = ''
      switch (sortField) {
        case 'proposal_number':
          aVal = a.proposal_number || ''
          bVal = b.proposal_number || ''
          break
        case 'proposal_name':
          aVal = a.name || ''
          bVal = b.name || ''
          break
        case 'project_number':
          aVal = a.project_number || ''
          bVal = b.project_number || ''
          break
      }
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })

    return filtered
  }, [proposals, searchQuery, statusFilter, sortField, sortDirection, autoCloseMutation])

  const toggleProposal = (proposalId: number) => {
    setExpandedProposals(prev => {
      const newSet = new Set(prev)
      if (newSet.has(proposalId)) {
        newSet.delete(proposalId)
      } else {
        newSet.add(proposalId)
      }
      return newSet
    })
  }

  const expandAll = () => {
    setExpandedProposals(new Set(filteredProposals.map(p => p.id)))
  }

  const collapseAll = () => {
    setExpandedProposals(new Set())
  }

  const columnClasses = {
    expand: 'w-[36px]',
    proposalNumber: 'w-[95px]',
    proposalName: 'w-[160px]',
    projectNumber: 'w-[90px]',
    submitted: 'w-[100px]',
    bseAmount: 'w-[110px]',
    status: 'w-[110px]',
    executedDate: 'w-[120px]',
    actions: 'w-[70px]',
  }
  const columnWidths = [36, 95, 160, 90, 100, 110, 110, 120, 70]

  // Calculate stats
  const stats = useMemo(() => {
    if (!proposals) {
      return { total: 0, executed: 0, pending: 0, totalValue: 0, executedValue: 0, pendingValue: 0 }
    }
    const now = new Date()
    const executedProposals = proposals.filter(p => p.date_executed)
    const pendingProposals = proposals.filter(p => {
      if (p.date_executed) return false
      const submittedDate = p.date_submitted ? new Date(p.date_submitted) : null
      const isOlderThanThreeMonths = submittedDate
        ? now.getTime() - submittedDate.getTime() > 90 * 24 * 60 * 60 * 1000
        : false
      return p.status !== 'closed' && !isOlderThanThreeMonths
    })
    const executed = executedProposals.length
    const pending = pendingProposals.length
    const executedValue = executedProposals.reduce((sum, p) => sum + (p.bse_amount || 0), 0)
    const pendingValue = pendingProposals.reduce((sum, p) => sum + (p.bse_amount || 0), 0)
    const totalValue = proposals.reduce((sum, p) => sum + (p.bse_amount || 0), 0)
    return {
      total: proposals.length,
      executed,
      pending,
      totalValue,
      executedValue,
      pendingValue,
    }
  }, [proposals])

  const buildBuckets = (
    startDate: Date,
    endDate: Date,
    granularity: 'year' | 'quarter' | 'month'
  ) => {
    const buckets: { label: string; total: number }[] = []
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

    while (cursor <= end) {
      let label = ''
      if (granularity === 'year') {
        label = `${cursor.getFullYear()}`
        buckets.push({ label, total: 0 })
        cursor.setFullYear(cursor.getFullYear() + 1)
        cursor.setMonth(0)
      } else if (granularity === 'quarter') {
        const q = Math.floor(cursor.getMonth() / 3) + 1
        label = `Q${q} ${cursor.getFullYear()}`
        buckets.push({ label, total: 0 })
        cursor.setMonth(cursor.getMonth() + 3)
      } else {
        label = cursor.toLocaleString('en-US', { month: 'short' }) + ` ${cursor.getFullYear()}`
        buckets.push({ label, total: 0 })
        cursor.setMonth(cursor.getMonth() + 1)
      }
    }
    return buckets
  }

  const computePolyTrend = (values: number[], degree: number) => {
    const n = values.length
    if (n === 0) return []
    // Avoid exact interpolation when buckets are few (keeps trend from hugging points).
    const d = Math.min(degree, Math.max(1, n - 2))
    const m = d + 1
    const A: number[][] = Array.from({ length: m }, () => Array(m).fill(0))
    const b: number[] = Array(m).fill(0)

    for (let i = 0; i < n; i += 1) {
      const x = i
      let xPow = 1
      const powers: number[] = Array(m).fill(0)
      for (let j = 0; j < m; j += 1) {
        powers[j] = xPow
        xPow *= x
      }
      for (let row = 0; row < m; row += 1) {
        b[row] += powers[row] * values[i]
        for (let col = 0; col < m; col += 1) {
          A[row][col] += powers[row] * powers[col]
        }
      }
    }

    // Gaussian elimination
    for (let i = 0; i < m; i += 1) {
      let maxRow = i
      for (let k = i + 1; k < m; k += 1) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
          maxRow = k
        }
      }
      ;[A[i], A[maxRow]] = [A[maxRow], A[i]]
      ;[b[i], b[maxRow]] = [b[maxRow], b[i]]

      const pivot = A[i][i] || 1
      for (let j = i; j < m; j += 1) {
        A[i][j] /= pivot
      }
      b[i] /= pivot

      for (let k = 0; k < m; k += 1) {
        if (k === i) continue
        const factor = A[k][i]
        for (let j = i; j < m; j += 1) {
          A[k][j] -= factor * A[i][j]
        }
        b[k] -= factor * b[i]
      }
    }

    return values.map((_, idx) => {
      let y = 0
      let xPow = 1
      for (let j = 0; j < m; j += 1) {
        y += b[j] * xPow
        xPow *= idx
      }
      return y
    })
  }

  const getLabelForDate = (date: Date, granularity: 'year' | 'quarter' | 'month') => {
    if (granularity === 'year') return `${date.getFullYear()}`
    if (granularity === 'quarter') {
      const q = Math.floor(date.getMonth() / 3) + 1
      return `Q${q} ${date.getFullYear()}`
    }
    return date.toLocaleString('en-US', { month: 'short' }) + ` ${date.getFullYear()}`
  }

  const proposedSeries = useMemo(() => {
    if (!proposals || proposals.length === 0) return []
    const dates = proposals
      .map((p) => p.date_submitted)
      .filter(Boolean)
      .map((date) => new Date(date as string))
    if (!dates.length) return []
    const startDate = dates.reduce((min, d) => (d < min ? d : min), dates[0])
    const endDate = new Date()
    const buckets = buildBuckets(startDate, endDate, proposedGranularity)
    const indexByLabel = new Map(buckets.map((b, idx) => [b.label, idx]))

    proposals.forEach((proposal) => {
      if (!proposal.date_submitted) return
      const submitted = new Date(proposal.date_submitted)
      const label = getLabelForDate(submitted, proposedGranularity)
      const idx = indexByLabel.get(label)
      if (idx === undefined) return
      buckets[idx].total += Number(proposal.bse_amount) || 0
    })

    const trend = computePolyTrend(buckets.map((b) => b.total), 6)
    return buckets.map((b, idx) => ({ ...b, trend: trend[idx] }))
  }, [proposals, proposedGranularity])

  const executedSeries = useMemo(() => {
    if (!proposals || proposals.length === 0) return []
    const dates = proposals
      .map((p) => p.date_executed)
      .filter(Boolean)
      .map((date) => new Date(date as string))
    if (!dates.length) return []
    const startDate = dates.reduce((min, d) => (d < min ? d : min), dates[0])
    const endDate = new Date()
    const buckets = buildBuckets(startDate, endDate, executedGranularity)
    const indexByLabel = new Map(buckets.map((b, idx) => [b.label, idx]))

    proposals.forEach((proposal) => {
      if (!proposal.date_executed) return
      const executed = new Date(proposal.date_executed)
      const label = getLabelForDate(executed, executedGranularity)
      const idx = indexByLabel.get(label)
      if (idx === undefined) return
      buckets[idx].total += Number(proposal.bse_amount) || 0
    })

    const trend = computePolyTrend(buckets.map((b) => b.total), 6)
    return buckets.map((b, idx) => ({ ...b, trend: trend[idx] }))
  }, [proposals, executedGranularity])

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalValue)} ({stats.total})
            </div>
            <p className="text-xs text-muted-foreground">Total Proposed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.executedValue)} ({stats.executed})
            </div>
            <p className="text-xs text-muted-foreground">Total Executed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(stats.pendingValue)} ({stats.pending})
            </div>
            <p className="text-xs text-muted-foreground">Total Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardContent className="p-4">
            <div className="relative mb-2 flex min-h-8 items-center justify-end">
              <div className="pointer-events-none absolute inset-x-0 text-center text-lg font-semibold">
                Total Proposed
              </div>
              <div>
                <Select value={proposedGranularity} onValueChange={(value) => setProposedGranularity(value as 'year' | 'quarter' | 'month')}>
                  <SelectTrigger className="h-7 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="year">Year</SelectItem>
                    <SelectItem value="quarter">Quarter</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={330}>
              <BarChart
                data={proposedSeries.length ? proposedSeries : [{ label: 'Q1', total: 0 }]}
                margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="total" fill="#555555" radius={[4, 4, 0, 0]} barSize={18} />
                <Line type="natural" dataKey="trend" stroke="#111111" strokeWidth={2} dot={false} strokeDasharray="6 4" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardContent className="p-4">
            <div className="relative mb-2 flex min-h-8 items-center justify-end">
              <div className="pointer-events-none absolute inset-x-0 text-center text-lg font-semibold">
                Total Executed
              </div>
              <div>
                <Select value={executedGranularity} onValueChange={(value) => setExecutedGranularity(value as 'year' | 'quarter' | 'month')}>
                  <SelectTrigger className="h-7 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="year">Year</SelectItem>
                    <SelectItem value="quarter">Quarter</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={330}>
              <BarChart
                data={executedSeries.length ? executedSeries : [{ label: 'Q1', total: 0 }]}
                margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="total" fill="#000000" radius={[4, 4, 0, 0]} barSize={18} />
                <Line type="natural" dataKey="trend" stroke="#111111" strokeWidth={2} dot={false} strokeDasharray="6 4" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Proposal
              </Button>
            </div>
            <div className="flex-1 min-w-[200px] max-w-[400px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search proposals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="executed">Executed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposals List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table className="table-fixed">
              <colgroup>
                {columnWidths.map((width, index) => (
                  <col key={index} style={{ width }} />
                ))}
              </colgroup>
              <TableHeader>
                <TableRow>
                <TableHead className={columnClasses.expand}></TableHead>
                <TableHead className={columnClasses.proposalNumber}>
                  <SortButton field="proposal_number">Proposal #</SortButton>
                </TableHead>
                <TableHead className={columnClasses.proposalName}>
                  <SortButton field="proposal_name">Proposal Name</SortButton>
                </TableHead>
                <TableHead className={columnClasses.projectNumber}>
                  <SortButton field="project_number">Project #</SortButton>
                </TableHead>
                <TableHead className={columnClasses.submitted}>
                  <SortButton field="submitted">Date Submitted</SortButton>
                </TableHead>
                <TableHead className={`${columnClasses.bseAmount} text-right`}>
                  <div className="flex justify-end">
                    <SortButton field="bse_amount">BSE Amount</SortButton>
                  </div>
                </TableHead>
                <TableHead className={columnClasses.status}>
                  <SortButton field="status">Status</SortButton>
                </TableHead>
                <TableHead className={columnClasses.executedDate}>
                  <SortButton field="executed_date">Date Executed</SortButton>
                </TableHead>
                <TableHead className={`${columnClasses.actions} text-right`}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.map((proposal) => {
                  const isExpanded = expandedProposals.has(proposal.id)
                  const phases = proposal.proposal_phases || []
                  const sortedPhases = [...phases].sort((a, b) => {
                    const normalize = (code: string | null) => (code || '').toUpperCase().trim()
                    const aCode = normalize(a.phase_code)
                    const bCode = normalize(b.phase_code)

                    const parsePrimary = (code: string) => {
                      const match = code.match(/^([AC])(\d+)$/)
                      if (!match) return null
                      return { prefix: match[1], num: Number(match[2]) }
                    }

                    const aPrimary = parsePrimary(aCode)
                    const bPrimary = parsePrimary(bCode)
                    if (aPrimary && bPrimary) {
                      if (aPrimary.prefix !== bPrimary.prefix) {
                        return aPrimary.prefix.localeCompare(bPrimary.prefix)
                      }
                      return aPrimary.num - bPrimary.num
                    }
                    if (aPrimary) return -1
                    if (bPrimary) return 1

                    if (aCode === 'CA' && bCode !== 'CA') return -1
                    if (bCode === 'CA' && aCode !== 'CA') return 1

                    return aCode.localeCompare(bCode)
                  })
                  return (
                    <React.Fragment key={proposal.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 h-10 [&>td]:py-1"
                        onClick={() => toggleProposal(proposal.id)}
                      >
                        <TableCell className={`${columnClasses.expand} py-1`}>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className={`${columnClasses.proposalNumber} font-mono font-medium py-1`}>
                          {proposal.proposal_number}
                        </TableCell>
                        <TableCell className={`${columnClasses.proposalName} font-medium py-1`}>
                          <div className="truncate">{proposal.name}</div>
                        </TableCell>
                        <TableCell className={`${columnClasses.projectNumber} font-mono py-1`}>
                          {proposal.project_number || '—'}
                        </TableCell>
                        <TableCell className={`${columnClasses.submitted} py-1`}>
                          {proposal.date_submitted ? formatDate(proposal.date_submitted) : '—'}
                        </TableCell>
                        <TableCell className={`${columnClasses.bseAmount} text-right font-mono py-1`}>
                          {formatCurrency(proposal.bse_amount)}
                        </TableCell>
                        <TableCell className={`${columnClasses.status} py-1`}>
                          <Badge variant={getComputedStatus(proposal, new Date()) === 'executed' ? 'default' : getComputedStatus(proposal, new Date()) === 'closed' ? 'outline' : 'secondary'}>
                            {getComputedStatus(proposal, new Date()).replace(/^./, (char) => char.toUpperCase())}
                          </Badge>
                        </TableCell>
                        <TableCell className={`${columnClasses.executedDate} py-1`}>
                          <div className="relative">
                            <Input
                              type="text"
                              readOnly
                              value={proposal.date_executed ? formatDate(proposal.date_executed) : ''}
                              onClick={(event) => event.stopPropagation()}
                              className={`h-7 pr-14 ${
                                proposal.date_executed
                                  ? ''
                                  : getComputedStatus(proposal, new Date()) === 'executed'
                                    ? 'bg-muted/40'
                                    : ''
                              }`}
                            />
                            {proposal.date_executed ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-7 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  updateExecutedDateMutation.mutate({
                                    proposalId: proposal.id,
                                    date: null,
                                  })
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            ) : null}
                            <Input
                              type="date"
                              value={proposal.date_executed || ''}
                              onChange={(event) =>
                                updateExecutedDateMutation.mutate({
                                  proposalId: proposal.id,
                                  date: event.target.value || null,
                                })
                              }
                              onClick={(event) => event.stopPropagation()}
                              className="absolute inset-y-0 right-0 w-8 opacity-0 cursor-pointer"
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={`${columnClasses.actions} text-right py-1`}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(event) => {
                                event.stopPropagation()
                                openEditDialog(proposal)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(event) => {
                                event.stopPropagation()
                                if (confirm(`Delete proposal ${proposal.proposal_number}?`)) {
                                  deleteProposalMutation.mutate(proposal)
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <>
                          {sortedPhases.length > 0 ? (
                            <>
                              <TableRow key={`${proposal.id}-phase-header`} className="bg-muted/30 text-xs text-muted-foreground">
                                <TableCell className={columnClasses.expand}></TableCell>
                                <TableCell className={columnClasses.proposalNumber}>Phase</TableCell>
                                <TableCell className={columnClasses.proposalName}>Description</TableCell>
                                <TableCell className={columnClasses.projectNumber}></TableCell>
                                <TableCell className={columnClasses.submitted}>Type</TableCell>
                                <TableCell className={`${columnClasses.bseAmount} text-right`}>Amount</TableCell>
                                <TableCell className={columnClasses.status}></TableCell>
                                <TableCell className={columnClasses.executedDate}></TableCell>
                                <TableCell className={columnClasses.actions}></TableCell>
                              </TableRow>
                              {sortedPhases.map((phase) => (
                                <TableRow key={phase.id} className="bg-muted/30 text-xs text-muted-foreground [&>td]:py-1">
                                  <TableCell className={columnClasses.expand}></TableCell>
                                  <TableCell className={`${columnClasses.proposalNumber} font-mono font-medium`}>
                                    {phase.phase_code}
                                  </TableCell>
                                  <TableCell className={columnClasses.proposalName}>
                                    <div className="truncate">{phase.phase_name}</div>
                                  </TableCell>
                                  <TableCell className={columnClasses.projectNumber}></TableCell>
                                  <TableCell className={columnClasses.submitted}>
                                    <Badge variant={phase.billing_type === 'H' ? 'outline' : 'secondary'}>
                                      {phase.billing_type === 'H' ? 'Hourly' : 'Lump Sum'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className={`${columnClasses.bseAmount} text-right font-mono`}>
                                    {formatCurrency(phase.amount)}
                                  </TableCell>
                                  <TableCell className={columnClasses.status}></TableCell>
                                  <TableCell className={columnClasses.executedDate}></TableCell>
                                  <TableCell className={columnClasses.actions}></TableCell>
                                </TableRow>
                              ))}
                            </>
                          ) : (
                            <TableRow key={`${proposal.id}-no-phases`} className="bg-muted/30">
                              <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
                                No phases defined for this proposal
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  )
                })}
                {filteredProposals.length === 0 && (
                  <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchQuery || statusFilter !== 'all'
                        ? 'No proposals match the current filters'
                        : 'No proposals found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="!max-w-none max-h-[90vh] overflow-y-auto"
          style={{ width: '98vw', maxWidth: '98vw' }}
        >
          <DialogHeader>
            <DialogTitle>{editingProposal ? 'Edit Proposal' : 'Add Proposal'}</DialogTitle>
            <DialogDescription>
              Enter proposal details and phase breakdown.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proposal Number</Label>
                <Input
                  value={formData.proposalNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, proposalNumber: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Proposal Name</Label>
                <Input
                  value={formData.proposalName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, proposalName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Date Submitted</Label>
                <Input
                  type="date"
                  value={formData.submittedDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, submittedDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phases</Label>
              <div className="rounded-lg border">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Phase</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[130px]">Type</TableHead>
                      <TableHead className="w-[140px] text-right">Amount</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.phases.map((phase, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            placeholder="A1"
                            value={phase.phaseCode}
                            onChange={(e) =>
                              setFormData((prev) => {
                                const next = [...prev.phases]
                                next[index] = { ...next[index], phaseCode: e.target.value }
                                return { ...prev, phases: next }
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={phase.phaseName}
                            onValueChange={(value) =>
                              setFormData((prev) => {
                                const next = [...prev.phases]
                                next[index] = { ...next[index], phaseName: value }
                                return { ...prev, phases: next }
                              })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select phase" />
                            </SelectTrigger>
                            <SelectContent>
                              {phaseOptions?.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={phase.billingType}
                            onValueChange={(value) =>
                              setFormData((prev) => {
                                const next = [...prev.phases]
                                next[index] = {
                                  ...next[index],
                                  billingType: value as 'L' | 'H',
                                }
                                return { ...prev, phases: next }
                              })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="L">Lump Sum</SelectItem>
                              <SelectItem value="H">Hourly</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            placeholder="$0.00"
                            value={phase.amount}
                            onChange={(e) =>
                              setFormData((prev) => {
                                const next = [...prev.phases]
                                next[index] = { ...next[index], amount: e.target.value }
                                return { ...prev, phases: next }
                              })
                            }
                            onBlur={(e) => {
                              const raw = e.target.value.replace(/[^0-9.-]/g, '')
                              const value = Number(raw)
                              if (Number.isNaN(value)) return
                              setFormData((prev) => {
                                const next = [...prev.phases]
                                next[index] = {
                                  ...next[index],
                                  amount: formatCurrency(value),
                                }
                                return { ...prev, phases: next }
                              })
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {formData.phases.length > 1 ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  phases: prev.phases.filter((_, i) => i !== index),
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    phases: [
                      ...prev.phases,
                      { phaseCode: '', phaseName: '', billingType: 'L', amount: '' },
                    ],
                  }))
                }
              >
                Add Phase
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
              disabled={createProposalMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingProposal ? updateProposalMutation.mutate() : createProposalMutation.mutate()
              }
              disabled={createProposalMutation.isPending || updateProposalMutation.isPending}
            >
              {createProposalMutation.isPending || updateProposalMutation.isPending
                ? 'Saving...'
                : editingProposal
                  ? 'Save Changes'
                  : 'Save Proposal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
