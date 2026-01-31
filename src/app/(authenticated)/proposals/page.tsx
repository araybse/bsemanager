'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
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

export default function ProposalsPage() {
  const supabase = createClient()

  const { data: proposals, isLoading } = useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .order('date_submitted', { ascending: false })
      if (error) throw error
      return data as Tables<'proposals'>[]
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Proposals</h2>
          <p className="text-sm text-muted-foreground">
            Track submitted and executed proposals
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Proposal
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
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
                  <TableHead>Proposal #</TableHead>
                  <TableHead>Project #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>PM</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">BSE Amount</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals?.map((proposal) => (
                  <TableRow key={proposal.id}>
                    <TableCell className="font-mono font-medium">
                      {proposal.proposal_number}
                    </TableCell>
                    <TableCell className="font-mono">
                      {proposal.project_number || '—'}
                    </TableCell>
                    <TableCell>{proposal.name}</TableCell>
                    <TableCell>{proposal.pm_name || '—'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(proposal.total_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(proposal.bse_amount)}
                    </TableCell>
                    <TableCell>
                      {proposal.date_submitted ? formatDate(proposal.date_submitted) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={proposal.date_executed ? 'default' : 'secondary'}>
                        {proposal.date_executed ? 'Executed' : 'Pending'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {proposals?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No proposals found
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
