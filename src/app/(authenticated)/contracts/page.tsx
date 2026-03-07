'use client'

import { useEffect, useState, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import type { Views } from '@/lib/types/database'

export default function ContractsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['active-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_contracts_view')
        .select('*')
        .order('project_number')
        .order('phase_code')
      if (error) throw error
      return data as Views<'active_contracts_view'>[]
    },
  })

  // Group by project
  const groupedContracts = useMemo(() => {
    if (!contracts) return {}
    
    return contracts.reduce((acc, contract) => {
      const key = contract.project_number
      if (!acc[key]) {
        acc[key] = {
          project_number: contract.project_number,
          project_name: contract.project_name,
          phases: [],
        }
      }
      acc[key].phases.push(contract)
      return acc
    }, {} as Record<string, { project_number: string; project_name: string; phases: typeof contracts }>)
  }, [contracts])

  // Filter by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return Object.values(groupedContracts)
    
    const query = searchQuery.toLowerCase()
    return Object.values(groupedContracts).filter(project => {
      // Match project number or name
      if (project.project_number?.toLowerCase().includes(query)) return true
      if (project.project_name?.toLowerCase().includes(query)) return true
      
      // Match any phase code or name
      return project.phases.some(phase => 
        phase.phase_code?.toLowerCase().includes(query) ||
        phase.phase_name?.toLowerCase().includes(query)
      )
    })
  }, [groupedContracts, searchQuery])

  const toggleProject = (projectNumber: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev)
      if (newSet.has(projectNumber)) {
        newSet.delete(projectNumber)
      } else {
        newSet.add(projectNumber)
      }
      return newSet
    })
  }

  const expandAll = () => {
    setExpandedProjects(new Set(filteredProjects.map(p => p.project_number)))
  }

  const collapseAll = () => {
    setExpandedProjects(new Set())
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Active Contracts</h2>
        <p className="text-sm text-muted-foreground">
          View and manage contract phases for all projects
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] max-w-[400px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by project or phase..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
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

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right w-[140px]">Phases</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => {
                  const isExpanded = expandedProjects.has(project.project_number)

                  return (
                    <Fragment key={project.project_number}>
                      <TableRow
                        key={project.project_number}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleProject(project.project_number)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-mono text-sm">{project.project_number}</span>
                            <span>{project.project_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">
                            {project.phases.length} phase{project.phases.length !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${project.project_number}-details`}>
                          <TableCell colSpan={2} className="p-0">
                            <div className="bg-muted/20 p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[100px]">Phase</TableHead>
                                    <TableHead>Phase Name</TableHead>
                                    <TableHead className="w-[60px]">Type</TableHead>
                                    <TableHead className="text-right">Total Fee</TableHead>
                                    <TableHead className="text-right">%</TableHead>
                                    <TableHead className="text-right">Billed</TableHead>
                                    <TableHead className="text-right">Remaining</TableHead>
                                    <TableHead className="text-right">This Month</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {project.phases.map((phase) => (
                                    <TableRow key={phase.id}>
                                      <TableCell className="font-mono">{phase.phase_code}</TableCell>
                                      <TableCell>{phase.phase_name}</TableCell>
                                      <TableCell>
                                        <Badge variant={phase.billing_type === 'H' ? 'outline' : 'secondary'}>
                                          {phase.billing_type === 'H' ? 'Hourly' : 'Lump Sum'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-mono">
                                        {formatCurrency(phase.total_fee)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatPercent(phase.pct_complete)}
                                      </TableCell>
                                      <TableCell className="text-right font-mono">
                                        {formatCurrency(phase.billed_to_date)}
                                      </TableCell>
                                      <TableCell className="text-right font-mono">
                                        {formatCurrency(phase.remaining)}
                                      </TableCell>
                                      <TableCell className="text-right font-mono">
                                        {phase.bill_this_month > 0 ? formatCurrency(phase.bill_this_month) : '—'}
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
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!isLoading && filteredProjects.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {searchQuery 
              ? 'No contracts match the current search'
              : 'No active contracts found. Add projects and their phases to get started.'}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
