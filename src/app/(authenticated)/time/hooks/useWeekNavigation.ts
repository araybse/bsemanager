import { useState, useMemo } from 'react'
import { getWeekEndingDate, getWeekStartDate } from '@/lib/timesheet/week-utils'

export function useWeekNavigation() {
  const [weekEndingDate, setWeekEndingDate] = useState(() => 
    getWeekEndingDate(new Date())
  )

  const currentWeek = useMemo(() => ({
    weekEndingDate,
    weekStartDate: getWeekStartDate(weekEndingDate)
  }), [weekEndingDate])

  const goToPreviousWeek = () => {
    const d = new Date(weekEndingDate + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    setWeekEndingDate(d.toISOString().split('T')[0])
  }

  const goToNextWeek = () => {
    const d = new Date(weekEndingDate + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    setWeekEndingDate(d.toISOString().split('T')[0])
  }

  const goToCurrentWeek = () => {
    setWeekEndingDate(getWeekEndingDate(new Date()))
  }

  const isCurrentWeek = weekEndingDate === getWeekEndingDate(new Date())

  return {
    currentWeek,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    isCurrentWeek
  }
}
