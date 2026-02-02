'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import { FileText, ArrowRight, DollarSign, Clock, Receipt } from 'lucide-react'
import Link from 'next/link'
import type { Views } from '@/lib/types/database'

export default function DashboardPage() {
  const supabase = createClient()
  const { isReady, user } = useAuth()

  // Only enable queries when auth is ready and we have a user
  const queryEnabled = isReady && !!user

  // Fetch billing candidates
  const { data: billingCandidates, isLoading: loadingCandidates } = useQuery({
    queryKey: ['billing-candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_candidates')
        .select('*')
      if (error) throw error
      return data as Views<'billing_candidates'>[]
    },
    enabled: queryEnabled,
  })

  // Fetch backlog summary
  const { data: backlog, isLoading: loadingBacklog } = useQuery({
    queryKey: ['backlog-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backlog_summary')
        .select('*')
        .single()
      if (error) throw error
      return data as Views<'backlog_summary'>
    },
    enabled: queryEnabled,
  })

  // Fetch accounts receivable
  const { data: arData, isLoading: loadingAR } = useQuery({
    queryKey: ['accounts-receivable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable_view')
        .select('*')
      if (error) throw error
      const typedData = data as Views<'accounts_receivable_view'>[]
      const total = typedData?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
      return { invoices: typedData, total }
    },
    enabled: queryEnabled,
  })

  const isLoading = !isReady || loadingBacklog || loadingAR || loadingCandidates

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backlog</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-xl font-bold truncate">
                  {formatCurrency(backlog?.total_backlog)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {backlog?.project_count || 0} active projects
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accounts Receivable</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-xl font-bold truncate">
                  {formatCurrency(arData?.total)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {arData?.invoices?.length || 0} unpaid invoices
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready to Bill</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-xl font-bold">
                  {billingCandidates?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Projects with billable activity
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Billing Candidates */}
      <Card>
        <CardHeader>
          <CardTitle>Projects Ready to Bill</CardTitle>
          <CardDescription>
            Projects with lump sum entries, unbilled time, or reimbursables
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : billingCandidates && billingCandidates.length > 0 ? (
            <div className="space-y-4">
              {billingCandidates.map((project) => (
                <div
                  key={project.project_id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{project.project_number}</span>
                      <span className="text-muted-foreground">—</span>
                      <span>{project.project_name}</span>
                    </div>
                    <div className="flex gap-2">
                      {project.reasons?.map((reason) => (
                        <Badge key={reason} variant="secondary">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/invoices/generate/${project.project_id}`}>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/projects/${project.project_id}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No projects ready to bill this month
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
