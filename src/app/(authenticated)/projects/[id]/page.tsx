'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { formatCurrency, formatPercent, formatHours } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import type { Tables } from '@/lib/types/database'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

type ProjectWithRelations = Tables<'projects'> & {
  clients: { name: string; address_line_1: string | null; address_line_2: string | null } | null
}

const PIE_COLORS = ['#000000', '#333333', '#555555', '#777777', '#999999', '#bbbbbb', '#dddddd']

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch project details
  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          clients (name, address_line_1, address_line_2)
        `)
        .eq('id', projectId)
        .single()
      if (error) throw error
      return data as ProjectWithRelations
    },
  })

  const { data: projectManagers } = useQuery({
    queryKey: ['project-managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'project_manager')
        .order('full_name')
      if (error) throw error
      return data as { id: string; full_name: string }[]
    },
  })

  const updateProjectManager = useMutation({
    mutationFn: async (pmId: string | null) => {
      const { error } = await supabase
        .from('projects')
        .update({ pm_id: pmId } as never)
        .eq('id', projectId as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Project manager updated')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update project manager')
    },
  })

  // Fetch contract phases
  const { data: phases, isLoading: loadingPhases } = useQuery({
    queryKey: ['project-phases', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('phase_code')
      if (error) throw error
      return data as Tables<'contract_phases'>[]
    },
  })

  // Fetch invoices
  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['project-invoices', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('project_id', projectId)
        .order('date_issued', { ascending: false })
      if (error) throw error
      return data as Tables<'invoices'>[]
    },
  })

  // Fetch ALL time entries for this project (for charts)
  const { data: allTimeEntries, isLoading: loadingAllTime } = useQuery({
    queryKey: ['project-all-time', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('project_id', projectId)
        .order('entry_date', { ascending: false })
      if (error) throw error
      return data as Tables<'time_entries'>[]
    },
  })

  // Fetch recent time entries for the table (limit 50)
  const { data: timeEntries, isLoading: loadingTime } = useQuery({
    queryKey: ['project-time', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('project_id', projectId)
        .order('entry_date', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Tables<'time_entries'>[]
    },
  })

  // Fetch reimbursables
  const { data: reimbursables, isLoading: loadingReimb } = useQuery({
    queryKey: ['project-reimbursables', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reimbursables')
        .select('*')
        .eq('project_id', projectId)
        .order('date_charged', { ascending: false })
      if (error) throw error
      return data as Tables<'reimbursables'>[]
    },
  })

  // Fetch submittals
  const { data: submittals, isLoading: loadingSubmittals } = useQuery({
    queryKey: ['project-submittals', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_submittals')
        .select('*')
        .eq('project_id', projectId)
        .order('commented_at', { ascending: false })
      if (error) throw error
      return data as Tables<'project_submittals'>[]
    },
  })

  // Calculate totals
  const totalFee = phases?.reduce((sum, p) => sum + Number(p.total_fee), 0) || 0
  const totalBilled = phases?.reduce((sum, p) => sum + Number(p.billed_to_date), 0) || 0
  const totalRemaining = totalFee - totalBilled
  const pctComplete = totalFee > 0 ? totalBilled / totalFee : 0

  // Calculate labor cost and multiplier
  const totalLaborCost = useMemo(() => {
    if (!allTimeEntries) return 0
    return allTimeEntries.reduce((sum, entry) => sum + (Number(entry.labor_cost) || 0), 0)
  }, [allTimeEntries])

  const multiplier = useMemo(() => {
    if (totalLaborCost === 0) return null
    return totalBilled / totalLaborCost
  }, [totalBilled, totalLaborCost])

  // Prepare phase chart data
  const phaseChartData = useMemo(() => {
    if (!phases) return []
    return phases.map(phase => ({
      name: phase.phase_code,
      fullName: phase.phase_name,
      contract: Number(phase.total_fee),
      billed: Number(phase.billed_to_date),
    }))
  }, [phases])

  // Prepare employee time distribution data
  const employeeTimeData = useMemo(() => {
    if (!allTimeEntries || allTimeEntries.length === 0) return []
    
    const byEmployee: Record<string, number> = {}
    allTimeEntries.forEach(entry => {
      const emp = entry.employee_name || 'Unknown'
      byEmployee[emp] = (byEmployee[emp] || 0) + (entry.hours || 0)
    })
    
    return Object.entries(byEmployee)
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)
  }, [allTimeEntries])

  const totalHours = useMemo(() => {
    return employeeTimeData.reduce((sum, e) => sum + e.hours, 0)
  }, [employeeTimeData])

  const submittalsByAgency = useMemo(() => {
    if (!submittals) return []
    const grouped = new Map<string, Tables<'project_submittals'>[]>()

    const isDepartmentRow = (item: Tables<'project_submittals'>) => {
      const department = (item.department || '').trim()
      const status = (item.status || '').toLowerCase()
      const comment = (item.comment || '').toLowerCase()

      if (!department) return false
      if (department.toLowerCase() === 'daily check') return false
      if (status === 'latest pdf uploaded') return false
      if (comment.includes('automated')) return false

      return true
    }

    submittals.forEach((item) => {
      const agency = item.agency || 'Unknown'
      const list = grouped.get(agency)
      if (list) {
        list.push(item)
      } else {
        grouped.set(agency, [item])
      }
    })

    return Array.from(grouped.entries())
      .map(([agency, items]) => {
        const sortedByDate = [...items].sort((a, b) => {
          const aDate = a.commented_at ? new Date(a.commented_at).getTime() : 0
          const bDate = b.commented_at ? new Date(b.commented_at).getTime() : 0
          return bDate - aDate
        })
        const latestPdf = sortedByDate.find((item) => item.pdf_url)?.pdf_url || null
        const departmentItems = items.filter(isDepartmentRow)

        const departmentMap = new Map<string, Tables<'project_submittals'>[]>()
        departmentItems.forEach((item) => {
          const dept = (item.department || 'Unknown').trim() || 'Unknown'
          const list = departmentMap.get(dept)
          if (list) {
            list.push(item)
          } else {
            departmentMap.set(dept, [item])
          }
        })

        const departments = Array.from(departmentMap.entries())
          .map(([department, deptItems]) => {
            const sorted = [...deptItems].sort((a, b) => {
              const aDate = a.commented_at ? new Date(a.commented_at).getTime() : 0
              const bDate = b.commented_at ? new Date(b.commented_at).getTime() : 0
              return bDate - aDate
            })
            return { department, items: sorted }
          })
          .sort((a, b) => a.department.localeCompare(b.department))

        return { agency, departments, latestPdf }
      })
      .filter(({ departments }) => departments.length > 0)
      .sort((a, b) => a.agency.localeCompare(b.agency))
  }, [submittals])

  if (loadingProject) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Project not found</p>
        <Button asChild className="mt-4">
          <Link href="/projects">Back to Projects</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">
              {project.project_number} {project.name}
            </h1>
            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
              {project.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground ml-10">
            <span>Client: {project.clients?.name || 'None'}</span>
            <div className="flex items-center gap-2">
              <span>Project Manager:</span>
              <Select
                value={project.pm_id ?? 'unassigned'}
                onValueChange={(value) =>
                  updateProjectManager.mutate(value === 'unassigned' ? null : value)
                }
              >
                <SelectTrigger className="h-8 w-[200px]">
                  <SelectValue placeholder="Select PM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {projectManagers?.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Button asChild>
          <Link href={`/invoices/generate/${projectId}`}>
            <FileText className="mr-2 h-4 w-4" />
            Generate Invoice
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Contract</CardDescription>
            <CardTitle className="text-xl">{formatCurrency(totalFee)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Billed to Date</CardDescription>
            <CardTitle className="text-xl">{formatCurrency(totalBilled)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remaining</CardDescription>
            <CardTitle className="text-xl">{formatCurrency(totalRemaining)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>% Complete</CardDescription>
            <CardTitle className="text-xl">{formatPercent(pctComplete)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Project Multiplier</CardDescription>
            <CardTitle className="text-xl">
              {multiplier !== null ? multiplier.toFixed(2) + 'x' : '—'}
            </CardTitle>
            {totalLaborCost > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Labor: {formatCurrency(totalLaborCost)}
              </p>
            )}
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="phases">
        <TabsList>
          <TabsTrigger value="phases">Contract Phases</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="time">Time Entries</TabsTrigger>
          <TabsTrigger value="reimbursables">Reimbursables</TabsTrigger>
          <TabsTrigger value="submittals">Submittals</TabsTrigger>
        </TabsList>

        <TabsContent value="phases" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loadingPhases ? (
                <div className="p-4">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phase</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Total Fee</TableHead>
                      <TableHead className="text-right">Billed</TableHead>
                      <TableHead className="text-right">This Month</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phases?.map((phase) => (
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
                        <TableCell className="text-right font-mono">
                          {formatCurrency(phase.billed_to_date)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(phase.bill_this_month) > 0 ? formatCurrency(phase.bill_this_month) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(Number(phase.total_fee) - Number(phase.billed_to_date))}
                        </TableCell>
                      </TableRow>
                    ))}
                    {phases?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No contract phases defined
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loadingInvoices ? (
                <div className="p-4">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date Issued</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices?.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{formatDate(invoice.date_issued)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(invoice.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={invoice.date_paid ? 'default' : 'secondary'}>
                            {invoice.date_paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {invoice.date_paid ? formatDate(invoice.date_paid) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {invoices?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No invoices yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loadingTime ? (
                <div className="p-4">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.entry_date)}</TableCell>
                        <TableCell>{entry.employee_name}</TableCell>
                        <TableCell>{entry.phase_name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatHours(entry.hours)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                          {entry.notes || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.is_billed ? 'default' : 'secondary'}>
                            {entry.is_billed ? 'Billed' : 'Unbilled'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {timeEntries?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No time entries
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reimbursables" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loadingReimb ? (
                <div className="p-4">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead className="text-right">To Charge</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reimbursables?.map((reimb) => (
                      <TableRow key={reimb.id}>
                        <TableCell>{formatDate(reimb.date_charged)}</TableCell>
                        <TableCell>{reimb.fee_description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(reimb.fee_amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(reimb.amount_to_charge)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={reimb.invoice_id ? 'default' : 'secondary'}>
                            {reimb.invoice_id ? 'Invoiced' : 'Pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {reimbursables?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No reimbursables
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submittals" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loadingSubmittals ? (
                <div className="p-4">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  <div className="text-xs text-muted-foreground">
                    Comments updated at 7am and 1pm daily.
                  </div>
                  {submittalsByAgency.map(({ agency, departments, latestPdf }) => (
                    <details key={agency} className="rounded-lg border">
                      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium flex items-center justify-between gap-4">
                        <span>{agency} ({departments.length})</span>
                        {latestPdf ? (
                          <a
                            href={latestPdf}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Button variant="outline" size="sm">
                              View PDF
                            </Button>
                          </a>
                        ) : null}
                      </summary>
                      <div className="px-4 pb-4 space-y-3">
                        {departments.map((dept) => {
                          const latest = dept.items[0]
                          return (
                            <details key={dept.department} className="rounded-lg border bg-muted/20">
                              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center justify-between gap-3">
                                <span>{dept.department}</span>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  {latest?.status ? (
                                    <Badge variant="secondary">{latest.status}</Badge>
                                  ) : null}
                                  <span>
                                    {latest?.commented_at ? formatDate(latest.commented_at) : '—'}
                                  </span>
                                </div>
                              </summary>
                              <div className="px-3 pb-3">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Comment</TableHead>
                                      <TableHead>Comment Date</TableHead>
                                      <TableHead>Source</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {dept.items.map((submittal) => (
                                      <TableRow key={submittal.id}>
                                        <TableCell>
                                          {submittal.status ? (
                                            <Badge variant="secondary">{submittal.status}</Badge>
                                          ) : (
                                            '—'
                                          )}
                                        </TableCell>
                                        <TableCell className="whitespace-pre-wrap text-muted-foreground text-sm">
                                          {submittal.comment || '—'}
                                        </TableCell>
                                        <TableCell>
                                          {submittal.commented_at ? formatDate(submittal.commented_at) : '—'}
                                        </TableCell>
                                        <TableCell>
                                          {submittal.source_url ? (
                                            <a
                                              href={submittal.source_url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-sm text-primary hover:underline"
                                            >
                                              View
                                            </a>
                                          ) : (
                                            '—'
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </details>
                          )
                        })}
                      </div>
                    </details>
                  ))}
                  {submittalsByAgency.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No submittal comments yet
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Phase Progress Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phase Progress</CardTitle>
            <CardDescription>Contract amount vs billed-to-date by phase</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPhases || loadingAllTime ? (
              <Skeleton className="h-[300px] w-full" />
            ) : phaseChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={phaseChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={60} />
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value))}
                    labelFormatter={(label) => {
                      const phase = phaseChartData.find(p => p.name === label)
                      return phase?.fullName || label
                    }}
                  />
                  <Bar dataKey="contract" fill="#d4d4d4" name="Contract" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="billed" fill="#000000" name="Billed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No phase data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee Time Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employee Time Distribution</CardTitle>
            <CardDescription>
              Total hours by employee ({formatHours(totalHours)} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAllTime ? (
              <Skeleton className="h-[300px] w-full" />
            ) : employeeTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={employeeTimeData}
                    dataKey="hours"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    labelLine={true}
                  >
                    {employeeTimeData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatHours(Number(value))}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No time entry data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
