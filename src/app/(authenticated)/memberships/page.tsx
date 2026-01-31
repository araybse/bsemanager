'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import { Plus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Tables } from '@/lib/types/database'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type MembershipWithSchedule = Tables<'memberships'> & {
  schedule: number[]
  total: number
}

export default function MembershipsPage() {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ['memberships'],
    queryFn: async () => {
      const { data: memberships, error: memError } = await supabase
        .from('memberships')
        .select('*')
        .order('name')
      if (memError) throw memError

      const { data: schedule, error: schError } = await supabase
        .from('membership_schedule')
        .select('*')
      if (schError) throw schError

      const typedMemberships = memberships as Tables<'memberships'>[]
      const typedSchedule = schedule as Tables<'membership_schedule'>[]

      // Organize schedule by membership
      const byMembership: MembershipWithSchedule[] = typedMemberships?.map((mem) => ({
        ...mem,
        schedule: MONTHS.map((_, idx) => {
          const entry = typedSchedule?.find((s) => s.membership_id === mem.id && s.month === idx + 1)
          return entry?.amount || 0
        }),
        total: typedSchedule
          ?.filter((s) => s.membership_id === mem.id)
          .reduce((sum, s) => sum + s.amount, 0) || 0,
      })) || []

      // Calculate monthly totals
      const monthlyTotals = MONTHS.map((_, idx) => 
        typedSchedule?.filter((s) => s.month === idx + 1).reduce((sum, s) => sum + s.amount, 0) || 0
      )

      return { memberships: byMembership, monthlyTotals }
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Memberships & Subscriptions</h2>
          <p className="text-sm text-muted-foreground">
            Software subscriptions and membership dues schedule
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Membership
        </Button>
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
                  <TableHead className="sticky left-0 bg-background">Subscription</TableHead>
                  {MONTHS.map((month) => (
                    <TableHead key={month} className="text-right min-w-[80px]">{month}</TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.memberships?.map((mem) => (
                  <TableRow key={mem.id}>
                    <TableCell className="sticky left-0 bg-background font-medium">
                      {mem.name}
                    </TableCell>
                    {mem.schedule.map((amount, idx) => (
                      <TableCell key={idx} className="text-right font-mono">
                        {amount > 0 ? formatCurrency(amount) : '—'}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(mem.total)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell className="sticky left-0 bg-muted/50">Total</TableCell>
                  {data?.monthlyTotals?.map((total, idx) => (
                    <TableCell key={idx} className="text-right font-mono">
                      {formatCurrency(total)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono">
                    {formatCurrency(data?.monthlyTotals?.reduce((a, b) => a + b, 0) || 0)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
