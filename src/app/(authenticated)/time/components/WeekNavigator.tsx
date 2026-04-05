'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { formatWeekRange } from '@/lib/timesheet/week-utils'

interface WeekNavigatorProps {
  weekStart: string
  weekEnd: string
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  isCurrentWeek?: boolean
}

export function WeekNavigator({
  weekStart,
  weekEnd,
  onPrevious,
  onNext,
  onToday,
  isCurrentWeek
}: WeekNavigatorProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={onPrevious}
        title="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="min-w-[200px] text-center">
        <span className="font-semibold">
          {formatWeekRange(weekStart, weekEnd)}
        </span>
      </div>
      
      <Button
        variant="outline"
        size="icon"
        onClick={onNext}
        title="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      
      {!isCurrentWeek && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToday}
          className="ml-2"
        >
          <Calendar className="h-4 w-4 mr-1" />
          Today
        </Button>
      )}
    </div>
  )
}
