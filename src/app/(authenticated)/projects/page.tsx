'use client'

import { useState, useMemo, useCallback, Fragment } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/lib/auth/use-permissions'
import { useProjectVisibility } from '@/lib/auth/use-project-visibility'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button as IconButton } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Plus, ArrowRight, Search, ArrowUpDown, ArrowUp, ArrowDown, Archive, ArchiveX } from 'lucide-react'
import Link from 'next/link'
import type { Tables, Views } from '@/lib/types/database'

type ProjectWithClient = Tables<'projects'> & {
  clients: { name: string } | null
}

type SortField = 'project_number' | 'name' | 'client' | 'multiplier'
type SortDirection = 'asc' | 'desc'

export default function ProjectsPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const perms = usePermissions()
  const projVis = useProjectVisibility()
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [filterProjectNumber, setFilterProjectNumber] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [filterCounty, setFilterCounty] = useState('all')
  const [filterProjectManager, setFilterProjectManager] = useState('all')
  
  // Sort state
  const [sortField, setSortField] = useState<SortField>('project_number')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({
    '23': true,
    '24': true,
    '25': true,
    '26': true,
  })

  // local archive state only used as fallback during migration

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-for-projects'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single()
      
      return profile as { id: string; role: string } | null
    },
  })

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects', currentUser?.id],
    queryFn: async () => {
      // For admins, show all projects
      if (currentUser?.role === 'admin') {
        const { data, error } = await supabase
          .from('projects')
          .select(`
            *,
            clients (name)
          `)
          .order('project_number', { ascending: false })
        if (error) throw error
        return data as ProjectWithClient[]
      }
      
      // For PMs and employees, show only their assigned projects
      if (!currentUser?.id) return []
      
      const { data: assignments, error: assignError } = await supabase
        .from('project_team_assignments')
        .select('project_id')
        .eq('user_id', currentUser.id)
      
      if (assignError) throw assignError
      
      const projectIds = (assignments as any[])?.map(a => a.project_id) || []
      
      // Also include projects where they are the PM
      const { data: pmProjects, error: pmError } = await supabase
        .from('projects')
        .select('id')
        .eq('project_manager_id', currentUser.id)
      
      if (pmError) throw pmError
      
      const allProjectIds = [...new Set([...projectIds, ...(pmProjects as any[] || [])?.map(p => p.id) || []])]
      
      if (allProjectIds.length === 0) {
        return []
      }
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          clients (name)
        `)
        .in('id', allProjectIds)
        .order('project_number', { ascending: false })
      
      if (error) throw error
      return data as ProjectWithClient[]
    },
  })

  const { data: pmOptions } = useQuery({
    queryKey: ['project-manager-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['project_manager', 'admin'])
        .order('full_name', { ascending: true })
      if (error) throw error
      return data as Tables<'profiles'>[]
    },
  })

  const { data: cityCountyOptions } = useQuery({
    queryKey: ['city-county-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('city_county_options' as never)
        .select('name')
        .eq('is_active' as never, true as never)
        .order('name')
      if (error) throw error
      return ((data || []) as Array<{ name: string | null }>)
        .map((row) => (row.name || '').trim())
        .filter(Boolean)
    },
  })

  const projectNumbers = useMemo(
    () =>
      (projects || [])
        .map((project) => project.project_number?.trim())
        .filter(Boolean) as string[],
    [projects]
  )
  const projectNumberOptions = useMemo(
    () => Array.from(new Set(projectNumbers)).sort((a, b) => a.localeCompare(b)),
    [projectNumbers]
  )
  const projectIds = useMemo(
    () => (projects || []).map((project) => Number(project.id)).filter((id) => Number.isFinite(id)),
    [projects]
  )
  const pmIds = useMemo(
    () => (projects || []).map((project) => project.pm_id).filter(Boolean) as string[],
    [projects]
  )
  const projectIdToNumber = useMemo(() => {
    const map = new Map<number, string>()
    projects?.forEach((project) => {
      const key = Number(project.id)
      const value = (project.project_number || '').trim()
      if (!Number.isNaN(key) && value) {
        map.set(key, value)
      }
    })
    return map
  }, [projects])

  const projectNumbersKey = useMemo(() => projectNumbers.join(','), [projectNumbers])
  const pmIdsKey = useMemo(() => pmIds.join(','), [pmIds])

  const { data: invoices } = useQuery({
    queryKey: ['project-invoices', projectNumbersKey],
    queryFn: async () => {
      if (!projectNumbers.length) return [] as Tables<'invoices'>[]
      const { data, error } = await supabase
        .from('invoices')
        .select('id, project_number')
        .in('project_number' as never, projectNumbers as never)
      if (error) throw error
      return data as Tables<'invoices'>[]
    },
    enabled: projectNumbers.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: pmProfiles } = useQuery({
    queryKey: ['project-managers', pmIdsKey],
    queryFn: async () => {
      if (!pmIds.length) return [] as Tables<'profiles'>[]
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id' as never, pmIds as never)
      if (error) throw error
      return data as Tables<'profiles'>[]
    },
    enabled: pmIds.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const pmById = useMemo(() => {
    const map = new Map<string, string>()
    pmProfiles?.forEach((profile) => {
      if (profile.id && profile.full_name) {
        map.set(profile.id, profile.full_name)
      }
    })
    return map
  }, [pmProfiles])

  const pmOptionsById = useMemo(() => {
    const map = new Map<string, string>()
    pmOptions?.forEach((profile) => {
      if (profile.id && profile.full_name) {
        map.set(profile.id, profile.full_name)
      }
    })
    return map
  }, [pmOptions])

  const clientOptions = useMemo(() => {
    const names = (projects || [])
      .map((project) => project.clients?.name?.trim())
      .filter(Boolean) as string[]
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
  }, [projects])

  const handleUpdateProjectManager = async (projectId: number, pmId: string | null) => {
    const { error } = await supabase
      .from('projects')
      .update({ pm_id: pmId } as never)
      .eq('id' as never, projectId as never)
    if (error) {
      console.error('Failed to update project manager:', error)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['projects'] })
  }

  const handleUpdateCounty = async (projectId: number, municipality: string | null) => {
    const { error } = await supabase
      .from('projects')
      .update({ municipality } as never)
      .eq('id' as never, projectId as never)
    if (error) {
      console.error('Failed to update municipality:', error)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['projects'] })
  }

  const invoiceIdToProjectNumber = useMemo(() => {
    const map = new Map<number, string>()
    invoices?.forEach((invoice) => {
      const key = Number(invoice.id)
      const value = (invoice.project_number || '').trim()
      if (!Number.isNaN(key) && value) {
        map.set(key, value)
      }
    })
    return map
  }, [invoices])

  const invoiceIds = useMemo(
    () => (invoices || []).map((invoice) => Number(invoice.id)).filter((id) => Number.isFinite(id)),
    [invoices]
  )
  const invoiceIdsKey = useMemo(() => invoiceIds.join(','), [invoiceIds])

  const invoiceIdsByProjectNumber = useMemo(() => {
    const map = new Map<string, Set<number>>()
    invoices?.forEach((invoice) => {
      const projectNumber = (invoice.project_number || '').trim()
      const invoiceId = Number(invoice.id)
      if (!projectNumber || Number.isNaN(invoiceId)) return
      if (!map.has(projectNumber)) {
        map.set(projectNumber, new Set())
      }
      map.get(projectNumber)!.add(invoiceId)
    })
    return map
  }, [invoices])

  const { data: invoiceLineItems } = useQuery({
    queryKey: ['project-line-items', invoiceIdsKey],
    queryFn: async () => {
      if (!invoiceIds.length) return [] as Tables<'invoice_line_items'>[]
      const { data, error } = await supabase
        .from('invoice_line_items')
        .select('invoice_id, project_number, amount')
        .in('invoice_id' as never, invoiceIds as never)
      if (error) throw error
      return data as Tables<'invoice_line_items'>[]
    },
    enabled: invoiceIds.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: reimbursables } = useQuery({
    queryKey: ['project-reimbursable-expenses', projectNumbersKey],
    queryFn: async () => {
      if (!projectNumbers.length)
        return [] as Array<{
          project_number: string | null
          fee_amount: number | null
          amount_to_charge: number | null
        }>
      const { data, error } = await supabase
        .from('project_expenses')
        .select('project_number, fee_amount, amount_to_charge')
        .eq('is_reimbursable', true)
        .in('project_number' as never, projectNumbers as never)
      if (error) throw error
      return (data || []) as Array<{
        project_number: string | null
        fee_amount: number | null
        amount_to_charge: number | null
      }>
    },
    enabled: projectNumbers.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const projectIdsKey = useMemo(() => projectIds.join(','), [projectIds])
  const { data: timeEntries } = useQuery({
    queryKey: ['project-time-entries', projectNumbersKey, projectIdsKey],
    queryFn: async () => {
      if (!projectNumbers.length && !projectIds.length) return [] as Tables<'time_entries'>[]
      const pageSize = 1000
      const results: Tables<'time_entries'>[] = []

      const fetchByNumber = async () => {
        if (!projectNumbers.length) return
        let from = 0
        while (true) {
          const { data, error } = await supabase
            .from('time_entries')
            .select('id, project_id, project_number, labor_cost')
            .in('project_number' as never, projectNumbers as never)
            .range(from, from + pageSize - 1)
          if (error) throw error
          results.push(...(data as Tables<'time_entries'>[]))
          if (!data || data.length < pageSize) break
          from += pageSize
        }
      }

      const fetchById = async () => {
        if (!projectIds.length) return
        let from = 0
        while (true) {
          const { data, error } = await supabase
            .from('time_entries')
            .select('id, project_id, project_number, labor_cost')
            .in('project_id' as never, projectIds as never)
            .range(from, from + pageSize - 1)
          if (error) throw error
          results.push(...(data as Tables<'time_entries'>[]))
          if (!data || data.length < pageSize) break
          from += pageSize
        }
      }

      await Promise.all([fetchByNumber(), fetchById()])

      const deduped = new Map<number, Tables<'time_entries'>>()
      results.forEach((entry) => {
        const key = Number(entry.id)
        if (!Number.isNaN(key)) {
          deduped.set(key, entry)
        }
      })

      return Array.from(deduped.values())
    },
    enabled: projectNumbers.length > 0 || projectIds.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: contractLabor } = useQuery({
    queryKey: ['project-contract-labor', projectNumbersKey],
    queryFn: async () => {
      if (!projectNumbers.length) return [] as Tables<'contract_labor'>[]
      const { data, error } = await supabase
        .from('contract_labor')
        .select('project_number, amount')
        .in('project_number' as never, projectNumbers as never)
      if (error) throw error
      return data as Tables<'contract_labor'>[]
    },
    enabled: projectNumbers.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: contractPhases } = useQuery({
    queryKey: ['project-contract-phases', projectIdsKey],
    queryFn: async () => {
      if (!projectIds.length) return [] as Tables<'contract_phases'>[]
      const { data, error } = await supabase
        .from('contract_phases')
        .select('project_id, phase_name')
        .in('project_id' as never, projectIds as never)
      if (error) throw error
      return data as Tables<'contract_phases'>[]
    },
    enabled: projectIds.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const billedByProjectNumber = useMemo(() => {
    const totals = new Map<string, number>()
    invoiceLineItems?.forEach((item) => {
      const key = item.invoice_id
        ? invoiceIdToProjectNumber.get(Number(item.invoice_id)) || ''
        : ''
      if (!key) return
      totals.set(key, (totals.get(key) || 0) + (Number(item.amount) || 0))
    })
    return totals
  }, [invoiceLineItems, invoiceIdToProjectNumber])

  const reimbFeeByProjectNumber = useMemo(() => {
    const totals = new Map<string, number>()
    reimbursables?.forEach((item) => {
      const key = (item.project_number || '').trim()
      if (!key) return
      totals.set(key, (totals.get(key) || 0) + (Number(item.fee_amount) || 0))
    })
    return totals
  }, [reimbursables])

  const reimbChargeByProjectNumber = useMemo(() => {
    const totals = new Map<string, number>()
    reimbursables?.forEach((item) => {
      const key = (item.project_number || '').trim()
      if (!key) return
      totals.set(key, (totals.get(key) || 0) + (Number(item.amount_to_charge) || 0))
    })
    return totals
  }, [reimbursables])

  const phaseNamesByProjectNumber = useMemo(() => {
    const map = new Map<string, Set<string>>()
    contractPhases?.forEach((phase) => {
      const projectNumber = projectIdToNumber.get(Number(phase.project_id))
      if (!projectNumber) return
      const name = (phase.phase_name || '').trim().toLowerCase()
      if (!name) return
      if (!map.has(projectNumber)) {
        map.set(projectNumber, new Set())
      }
      map.get(projectNumber)!.add(name)
    })
    return map
  }, [contractPhases, projectIdToNumber])

  const billedByProjectPhaseName = useMemo(() => {
    const totals = new Map<string, Map<string, number>>()
    invoiceLineItems?.forEach((item) => {
      const projectNumber =
        (item.project_number || '').trim() ||
        invoiceIdToProjectNumber.get(Number(item.invoice_id)) ||
        ''
      const phaseName = (item.phase_name || '').trim().toLowerCase()
      if (!projectNumber || !phaseName) return
      if (!totals.has(projectNumber)) {
        totals.set(projectNumber, new Map())
      }
      const byPhase = totals.get(projectNumber)!
      byPhase.set(phaseName, (byPhase.get(phaseName) || 0) + (Number(item.amount) || 0))
    })
    return totals
  }, [invoiceLineItems])

  const laborByProjectNumber = useMemo(() => {
    const totals = new Map<string, number>()
    timeEntries?.forEach((entry) => {
      let key = (entry.project_number || '').trim()
      if (!key && entry.project_id) {
        key = projectIdToNumber.get(Number(entry.project_id)) || ''
      }
      if (!key) return
      totals.set(key, (totals.get(key) || 0) + (Number(entry.labor_cost) || 0))
    })
    contractLabor?.forEach((entry) => {
      const key = (entry.project_number || '').trim()
      if (!key) return
      totals.set(key, (totals.get(key) || 0) + (Number(entry.amount) || 0))
    })
    return totals
  }, [timeEntries, contractLabor, projectIdToNumber])

  const { data: multipliers } = useQuery({
    queryKey: ['project-multipliers', projectNumbersKey],
    queryFn: async () => {
      if (!projectNumbers.length) return {} as Record<string, number | null>
      const response = await fetch(
        `/api/projects/multipliers?project_numbers=${encodeURIComponent(projectNumbers.join(','))}`
      )
      if (!response.ok) {
        throw new Error('Failed to load project multipliers')
      }
      const payload = await response.json()
      return (payload?.multipliers || {}) as Record<string, number | null>
    },
    enabled: projectNumbers.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })

  const getMultiplier = useCallback((project: ProjectWithClient) => {
    const projectNumber = (project.project_number || '').trim()
    if (!projectNumber) return null
    return multipliers?.[projectNumber] ?? null
  }, [multipliers])

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    if (!projects) return []
    
    const filtered = projects.filter(project => {
      // Only show projects with valid project numbers (XX-XX format)
      // This hides placeholder/overhead projects like "QB-196"
      const hasValidProjectNumber = /^\d{2}-\d{2}$/.test(project.project_number || '')
      if (!hasValidProjectNumber) return false

      const isArchived = Boolean((project as { is_archived?: boolean }).is_archived)
      if (!showArchived && isArchived) return false
      if (project.status !== 'active') return false
      
      if (filterProjectNumber !== 'all' && project.project_number !== filterProjectNumber) {
        return false
      }

      if (filterClient !== 'all' && project.clients?.name !== filterClient) {
        return false
      }

      if (
        filterCounty !== 'all' &&
        (project.municipality || '').trim().toUpperCase() !== filterCounty.trim().toUpperCase()
      ) {
        return false
      }

      if (filterProjectManager !== 'all' && (project.pm_id || '') !== filterProjectManager) {
        return false
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesNumber = project.project_number?.toLowerCase().includes(query)
        const matchesName = project.name?.toLowerCase().includes(query)
        const matchesClient = project.clients?.name?.toLowerCase().includes(query)
        if (!matchesNumber && !matchesName && !matchesClient) return false
      }
      
      return true
    })
    
    // Sort
    filtered.sort((a, b) => {
      if (sortField === 'multiplier') {
        const aVal = getMultiplier(a) ?? -Infinity
        const bVal = getMultiplier(b) ?? -Infinity
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      }

      let aVal: string = ''
      let bVal: string = ''
      
      switch (sortField) {
        case 'project_number':
          aVal = a.project_number || ''
          bVal = b.project_number || ''
          break
        case 'name':
          aVal = a.name || ''
          bVal = b.name || ''
          break
        case 'client':
          aVal = a.clients?.name || ''
          bVal = b.clients?.name || ''
          break
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    
    return filtered
  }, [
    projects,
    searchQuery,
    sortField,
    sortDirection,
    showArchived,
    filterProjectNumber,
    filterClient,
    filterCounty,
    filterProjectManager,
    getMultiplier,
  ])

  const projectsByYear = useMemo(() => {
    const groups = new Map<string, ProjectWithClient[]>()
    filteredProjects.forEach((project) => {
      const number = (project.project_number || '').trim()
      const year = number.slice(0, 2)
      if (!year) return
      if (!groups.has(year)) {
        groups.set(year, [])
      }
      groups.get(year)!.push(project)
    })
    groups.forEach((group) => {
      group.sort((a, b) => {
        const aNum = (a.project_number || '').trim()
        const bNum = (b.project_number || '').trim()
        return aNum.localeCompare(bNum)
      })
    })
    return groups
  }, [filteredProjects])

  const yearOrder = useMemo(() => ['23', '24', '25', '26'], [])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">All Projects</h2>
        </div>
        {perms.isAdmin() && (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Project
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] max-w-[400px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Project #</div>
          <Select value={filterProjectNumber} onValueChange={setFilterProjectNumber}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {projectNumberOptions.map((number) => (
                <SelectItem key={number} value={number}>
                  {number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Client</div>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {clientOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">City/County</div>
          <Select value={filterCounty} onValueChange={setFilterCounty}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {(cityCountyOptions || []).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Project Manager</div>
          <Select value={filterProjectManager} onValueChange={setFilterProjectManager}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {(pmOptions || []).map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(Boolean(checked))}
          />
          <label htmlFor="show-archived" className="text-sm font-medium">
            Show archived
          </label>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Projects List */}
      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-8 text-center text-destructive">
              Error loading projects: {error.message}
            </div>
          ) : isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Sort Controls */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project #</TableHead>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">City/County</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Project Manager</TableHead>
                    <TableHead className="text-right">
                      <div className="flex justify-end text-xs font-medium text-muted-foreground">
                        Multiplier
                      </div>
                    </TableHead>
                    {perms.isAdmin() && (
                      <>
                        <TableHead className="text-right text-xs font-medium text-muted-foreground">Action</TableHead>
                        <TableHead className="text-right text-xs font-medium text-muted-foreground">Archive</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearOrder.map((year) => {
                    const group = projectsByYear.get(year) || []
                    if (!group.length) return null
                    const isExpanded = expandedYears[year] ?? true
                    return (
                      <Fragment key={`year-${year}`}>
                        <TableRow className="bg-muted/20 font-medium">
                          <TableCell colSpan={perms.isAdmin() ? 8 : 6} className="py-2">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-sm font-medium"
                              onClick={() =>
                                setExpandedYears((prev) => ({ ...prev, [year]: !isExpanded }))
                              }
                            >
                              {isExpanded ? <ArrowDown className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                              {year}
                            </button>
                          </TableCell>
                        </TableRow>
                        {isExpanded &&
                          group.map((project) => (
                            <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50">
                              <TableCell className="font-mono font-medium">
                                <Link href={`/projects/${project.id}`} className="inline-flex">
                                  <Button variant="outline" size="sm" className="font-mono">
                                    {project.project_number}
                                  </Button>
                                </Link>
                              </TableCell>
                              <TableCell className="font-medium">
                                <Link href={`/projects/${project.id}`} className="block">
                                  {project.name}
                                </Link>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                <Link href={`/projects/${project.id}`} className="block">
                                  {project.clients?.name || 'No client'}
                                </Link>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                <Link href={`/projects/${project.id}`} className="block">
                                  {project.municipality || '—'}
                                </Link>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                <Link href={`/projects/${project.id}`} className="block">
                                  {project.pm_id ? pmById.get(project.pm_id) || '—' : '—'}
                                </Link>
                              </TableCell>
                              <TableCell className="text-right text-sm text-foreground">
                                <Link href={`/projects/${project.id}`} className="block">
                                  {(() => {
                                    const multiplier = getMultiplier(project)
                                    return typeof multiplier === 'number' ? `${multiplier.toFixed(2)}x` : '—'
                                  })()}
                                </Link>
                              </TableCell>
                              {perms.isAdmin() && (
                                <>
                                  <TableCell className="text-right">
                                    <Link href={`/projects/${project.id}?edit=phases`} className="inline-flex">
                                      <Button variant="outline" size="sm">
                                        Edit
                                      </Button>
                                    </Link>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <IconButton
                                      variant="ghost"
                                      size="icon"
                              onClick={async (event) => {
                                        event.stopPropagation()
                                const projectId = Number(project.id)
                                const nextArchived = !Boolean(
                                  (project as { is_archived?: boolean }).is_archived
                                )
                                queryClient.setQueryData<ProjectWithClient[]>(
                                  ['projects'],
                                  (prev) =>
                                    (prev || []).map((item) =>
                                      item.id === projectId
                                        ? ({ ...item, is_archived: nextArchived } as ProjectWithClient)
                                        : item
                                    )
                                )
                                const { error: updateError } = await supabase
                                  .from('projects')
                                  .update({ is_archived: nextArchived } as never)
                                  .eq('id' as never, projectId as never)
                                if (updateError) {
                                  console.error('Failed to update archive status:', updateError)
                                  queryClient.invalidateQueries({ queryKey: ['projects'] })
                                  return
                                }
                                      }}
                              aria-label={
                                (project as { is_archived?: boolean }).is_archived
                                  ? 'Unarchive project'
                                  : 'Archive project'
                              }
                                    >
                              {(project as { is_archived?: boolean }).is_archived ? (
                                        <ArchiveX className="h-4 w-4" />
                                      ) : (
                                        <Archive className="h-4 w-4" />
                                      )}
                                    </IconButton>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                      </Fragment>
                    )
                  })}
                  {filteredProjects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={perms.isAdmin() ? 8 : 6} className="text-center py-8 text-muted-foreground">
                        {searchQuery
                          ? 'No projects match the current filters'
                          : showArchived
                            ? 'No projects found. Create your first project to get started.'
                            : 'No active projects found. Create your first project to get started.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
