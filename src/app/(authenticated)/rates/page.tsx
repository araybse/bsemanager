'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Tables } from '@/lib/types/database'

type RateWithProject = Tables<'billable_rates'> & {
  projects: { project_number: string; name: string } | null
}

export default function RatesPage() {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ['billable-rates'],
    queryFn: async () => {
      // Get all rates
      const { data: rates, error } = await supabase
        .from('billable_rates')
        .select(`
          *,
          projects (project_number, name)
        `)
        .order('project_id')
        .order('employee_name')

      if (error) throw error

      const typedRates = rates as RateWithProject[]

      // Get unique employees
      const employees = [...new Set(typedRates?.map(r => r.employee_name) || [])]

      // Group by project
      const byProject = typedRates?.reduce((acc, rate) => {
        const proj = rate.projects
        const key = proj?.project_number || 'Unknown'
        if (!acc[key]) {
          acc[key] = {
            project_number: proj?.project_number || '',
            project_name: proj?.name || '',
            rates: {} as Record<string, number>,
          }
        }
        acc[key].rates[rate.employee_name] = rate.hourly_rate
        return acc
      }, {} as Record<string, { project_number: string; project_name: string; rates: Record<string, number> }>) || {}

      return { employees, byProject }
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Billable Rates Matrix</h2>
        <p className="text-sm text-muted-foreground">
          Hourly rates by project and employee
        </p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
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
                  <TableHead className="sticky left-0 bg-background">Project</TableHead>
                  {data?.employees.map((emp) => (
                    <TableHead key={emp} className="text-center min-w-[100px]">
                      {emp.split(' ')[0]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(data?.byProject || {}).map((project) => (
                  <TableRow key={project.project_number}>
                    <TableCell className="sticky left-0 bg-background font-mono">
                      {project.project_number}
                    </TableCell>
                    {data?.employees.map((emp) => (
                      <TableCell key={emp} className="text-center font-mono">
                        {project.rates[emp] ? formatCurrency(project.rates[emp]) : '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {Object.keys(data?.byProject || {}).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={(data?.employees.length || 0) + 1} className="text-center py-8 text-muted-foreground">
                      No rates defined
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
