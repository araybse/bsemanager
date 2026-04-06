'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface TotalHoursChartProps {
  userId: string
  currentUser: { id: string; email: string; full_name: string; role: string } | null
}

export function TotalHoursChart({ 
  userId,
  currentUser
}: TotalHoursChartProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  
  // Fetch data for the provided userId
  const { data: userData, isLoading } = useQuery({
    queryKey: ['total-hours-chart', userId],
    queryFn: async () => {
      const params = new URLSearchParams({ userId })
      const response = await fetch(`/api/dashboard/total-hours?${params}`)
      if (!response.ok) throw new Error('Failed to fetch total hours')
      return response.json()
    },
    enabled: !!userId,
  })
  
  const data = userData || []
  const availableYears = data?.map((d: any) => d.year).sort((a: number, b: number) => b - a) || []
  
  // Set initial year if available
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(parseInt(selectedYear))) {
      setSelectedYear(availableYears[0].toString())
    }
  }, [availableYears])

  // Get data for selected year
  const yearData = data?.find((d: any) => d.year.toString() === selectedYear)

  // Calculate cumulative hours
  const chartData = yearData?.monthlyHours.map((month: any, index: number) => {
    const cumulativeHours = yearData.monthlyHours
      .slice(0, index + 1)
      .reduce((sum: number, m: any) => sum + m.hours, 0)
    
    const targetHours = (index + 1) * (2000 / 12) // 167 hours per month
    
    return {
      month: month.month,
      actual: Math.round(cumulativeHours),
      target: Math.round(targetHours)
    }
  }) || []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Total Hours</CardTitle>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((year: number) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !chartData || chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No hours data available for {selectedYear}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ value: 'Cumulative Hours', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
              />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="actual" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Actual Hours"
                dot={{ fill: '#3b82f6', r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="target" 
                stroke="#94a3b8" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Target (2,000 hrs/year)"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
