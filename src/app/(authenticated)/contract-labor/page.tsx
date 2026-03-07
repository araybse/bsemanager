'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
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
import type { Tables } from '@/lib/types/database'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
type SortField = 'vendor' | 'date' | 'amount' | 'project'
type SortDirection = 'asc' | 'desc'

export default function ContractLaborPage() {
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  // Editing disabled for one-way QBO -> Supabase sync

  const { data: labor, isLoading } = useQuery({
    queryKey: ['contract-labor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_labor')
        .select('*')
        .order('project_number')
        .order('vendor_name')
      if (error) throw error
      return data as Tables<'contract_labor'>[]
    },
  })

  const { data: projects } = useQuery({
    queryKey: ['contract-labor-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_number')
        .order('project_number')
      if (error) throw error
      return data as { id: number; project_number: string }[]
    },
  })

  const vendors = useMemo(() => {
    const set = new Set<string>()
    labor?.forEach((entry) => {
      if (entry.vendor_name) {
        set.add(entry.vendor_name)
      }
    })
    return Array.from(set).sort()
  }, [labor])

  const projectNumbers = useMemo(() => {
    const set = new Set<string>()
    projects?.forEach((project) => {
      if (project.project_number) {
        set.add(project.project_number)
      }
    })
    return Array.from(set).sort()
  }, [projects])

  const projectNumberToId = useMemo(() => {
    const map = new Map<string, number>()
    projects?.forEach((project) => {
      if (project.project_number) {
        map.set(project.project_number, project.id)
      }
    })
    return map
  }, [projects])

  const getEntryDateValue = (entry: Tables<'contract_labor'>) => {
    if (entry.payment_date) {
      return new Date(entry.payment_date)
    }
    if (entry.year && entry.month) {
      return new Date(Date.UTC(entry.year, entry.month - 1, 1))
    }
    return null
  }

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
          entry.vendor_name.toLowerCase().includes(query) ||
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
          aVal = Number(a.amount) || 0
          bVal = Number(b.amount) || 0
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
          <h2 className="text-lg font-medium">Contract Labor</h2>
          <p className="text-sm text-muted-foreground">
            Sub-consultant and contractor expenses by project
          </p>
        </div>
        <Button disabled>
          Add Entry
        </Button>
      </div>

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
                    <SortButton field="vendor">Vendor</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="date">Date</SortButton>
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground">Description</TableHead>
                  <TableHead className="text-right text-xs text-muted-foreground">Amount</TableHead>
                  <TableHead>
                    <SortButton field="project">Project Number</SortButton>
                  </TableHead>
                  <TableHead className="text-right text-xs text-muted-foreground">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLabor.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.vendor_name}</TableCell>
                    <TableCell>
                      {entry.payment_date
                        ? formatDate(entry.payment_date)
                        : entry.month && entry.year
                          ? `${MONTHS[entry.month - 1]} ${entry.year}`
                          : '—'}
                    </TableCell>
                    <TableCell>{entry.description || '—'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(entry.amount)}
                    </TableCell>
                    <TableCell className="font-mono">{entry.project_number || '—'}</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                  </TableRow>
                ))}
                {sortedLabor.length > 0 && (
                  <TableRow className="font-medium bg-muted/20">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(
                        sortedLabor.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
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

    </div>
  )
}
