'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatHours } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/dates'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Tables } from '@/lib/types/database'

export default function TimeEntriesPage() {
  const supabase = createClient()

  const { data: timeEntries, isLoading } = useQuery({
    queryKey: ['time-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .limit(500)
      if (error) throw error
      return data as Tables<'time_entries'>[]
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Time Entries</h2>
        <p className="text-sm text-muted-foreground">
          Time entries imported from QuickBooks Time
        </p>
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
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Project</TableHead>
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
                    <TableCell className="font-mono">{entry.project_number}</TableCell>
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
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No time entries found
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
