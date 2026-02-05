'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button as IconButton } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [archivedProjectIds, setArchivedProjectIds] = useState<Set<number>>(new Set())
  
  // Sort state
  const [sortField, setSortField] = useState<SortField>('project_number')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('projects.archivedIds')
    if (!stored) return
    try {
      const ids = JSON.parse(stored) as number[]
      setArchivedProjectIds(new Set(ids.filter((id) => Number.isFinite(id))))
    } catch (error) {
      console.error('Failed to parse archived project ids:', error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('projects.archivedIds', JSON.stringify(Array.from(archivedProjectIds)))
  }, [archivedProjectIds])

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          clients (name)
        `)
        .order('project_number', { ascending: false })
      if (error) {
        console.error('Projects query error:', error)
        throw error
      }
      return data as ProjectWithClient[]
    },
  })

  const { data: projectTotals } = useQuery({
    queryKey: ['project-financial-totals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_financial_totals')
        .select('*')
      if (error) throw error
      return data as Views<'project_financial_totals'>[]
    },
  })

  const revenueByProject = useMemo(() => {
    const totals = new Map<number, number>()
    projectTotals?.forEach((row) => {
      totals.set(row.project_id, Number(row.revenue) || 0)
    })
    return totals
  }, [projectTotals])

  const laborByProject = useMemo(() => {
    const totals = new Map<number, number>()
    projectTotals?.forEach((row) => {
      totals.set(row.project_id, Number(row.labor_cost) || 0)
    })
    return totals
  }, [projectTotals])

  const getMultiplier = (project: ProjectWithClient) => {
    const revenue = revenueByProject.get(project.id) || 0
    const labor = laborByProject.get(project.id) || 0
    if (!labor || !revenue) return null
    if (project.name?.trim().toLowerCase().endsWith('private inspection')) return null
    return revenue / labor
  }

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    if (!projects) return []
    
    let filtered = projects.filter(project => {
      // Only show projects with valid project numbers (XX-XX format)
      // This hides placeholder/overhead projects like "QB-196"
      const hasValidProjectNumber = /^\d{2}-\d{2}$/.test(project.project_number || '')
      if (!hasValidProjectNumber) return false

      if (!showArchived && archivedProjectIds.has(project.id)) return false
      if (project.status !== 'active') return false
      
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
  }, [projects, searchQuery, sortField, sortDirection, archivedProjectIds, showArchived])

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
          <p className="text-sm text-muted-foreground">
            Manage your engineering projects
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Project
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>

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
                    <TableHead>
                      <SortButton field="project_number">Project #</SortButton>
                    </TableHead>
                    <TableHead>
                      <SortButton field="name">Project Name</SortButton>
                    </TableHead>
                    <TableHead>
                      <SortButton field="client">Client</SortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex justify-end">
                        <SortButton field="multiplier">Multiplier</SortButton>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Archive</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono font-medium">
                        <Link href={`/projects/${project.id}`} className="block">
                          {project.project_number}
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
                      <TableCell className="text-right text-sm text-foreground">
                        <Link href={`/projects/${project.id}`} className="block">
                          {(() => {
                            const multiplier = getMultiplier(project)
                            return multiplier ? `${multiplier.toFixed(2)}x` : '—'
                          })()}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <IconButton
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation()
                            setArchivedProjectIds((prev) => {
                              const next = new Set(prev)
                              if (next.has(project.id)) {
                                next.delete(project.id)
                              } else {
                                next.add(project.id)
                              }
                              return next
                            })
                          }}
                          aria-label={archivedProjectIds.has(project.id) ? 'Unarchive project' : 'Archive project'}
                        >
                          {archivedProjectIds.has(project.id) ? (
                            <ArchiveX className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredProjects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
