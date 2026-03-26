'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function TimesheetPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Timesheet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Weekly time entry
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-base font-medium min-w-[220px] text-center">
              Week of Mar 24-30, 2026
            </CardTitle>
            <Button variant="outline" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Timesheet table loading...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
