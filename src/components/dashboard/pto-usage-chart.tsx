'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface PTOUsageChartProps {
  employeeId: string | null
  currentUser: { id: string; email: string; full_name: string; role: string } | null
  userRole?: 'admin' | 'project_manager' | 'employee'
}

export function PTOUsageChart({ employeeId, currentUser, userRole }: PTOUsageChartProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear.toString())
  const [budgetedPTO, setBudgetedPTO] = useState<Record<string, number>>({})
  
  // Generate year options (current year and past 3 years)
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - i)
  
  // Determine which employee to show data for
  const effectiveEmployeeId = employeeId || currentUser?.id || ''
  
  // Fetch PTO data for the selected year
  const { data: ptoData, isLoading } = useQuery({
    queryKey: ['pto-usage-chart', selectedYear, effectiveEmployeeId],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: selectedYear,
        ...(effectiveEmployeeId ? { employee_id: effectiveEmployeeId } : {})
      })
      const response = await fetch(`/api/dashboard/pto-usage?${params}`)
      if (!response.ok) throw new Error('Failed to fetch PTO usage')
      return response.json()
    },
    enabled: !!effectiveEmployeeId,
  })
  
  // Check if selected year is current year
  const isCurrentYear = parseInt(selectedYear) === currentYear
  
  // Get current month index (0-11)
  const currentMonthIndex = new Date().getMonth()
  
  // Prepare chart data with budgeted amounts for future months
  const chartData = ptoData?.ptoUsage?.map((item: any, index: number) => {
    const isFutureMonth = isCurrentYear && index > currentMonthIndex
    const budgetedHours = isFutureMonth ? (budgetedPTO[item.month] || 0) : 0
    
    return {
      month: item.month,
      actual: item.cumulativeHours,
      budgeted: isFutureMonth ? item.cumulativeHours + budgetedHours : null,
      monthlyHours: item.monthlyHours,
      isFuture: isFutureMonth,
      isCurrent: isCurrentYear && index === currentMonthIndex
    }
  }) || []
  
  // Handle budget input change
  const handleBudgetChange = (month: string, value: string) => {
    const hours = parseFloat(value) || 0
    setBudgetedPTO(prev => ({
      ...prev,
      [month]: hours
    }))
  }
  
  // Reset budgeted PTO when year changes
  useEffect(() => {
    setBudgetedPTO({})
  }, [selectedYear])
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Paid Time Off</CardTitle>
          <CardDescription>
            Cumulative PTO, vacation, and sick time used
          </CardDescription>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !chartData || chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No PTO data available for {selectedYear}
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  height={80}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  domain={[0, 200]}
                  ticks={[0, 40, 80, 120, 160, 200]}
                  label={{ value: 'Cumulative Hours', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      const cumulativeDays = data.actual ? (data.actual / 8).toFixed(1) : '0.0'
                      const cumulativeWeeks = data.actual ? (data.actual / 40).toFixed(1) : '0.0'
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                          <p className="font-semibold mb-2">{data.month}</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-600">Monthly:</span>
                              <span className="font-medium">{data.monthlyHours?.toFixed(1)}h</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-600">Cumulative:</span>
                              <span className="font-medium">{data.actual?.toFixed(1)}h ({cumulativeDays} d, {cumulativeWeeks} wk)</span>
                            </div>
                            {data.budgeted && (
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600">With Budget:</span>
                                <span className="font-medium">{data.budgeted?.toFixed(1)}h</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />

                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="#0891b2" 
                  strokeWidth={2}
                  name="Actual PTO"
                  label={{ position: 'top', formatter: (value: any) => `${value?.toFixed(1)}`, fontSize: 11 }}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={payload.isCurrent ? 6 : 4}
                        fill={payload.isCurrent ? "#0891b2" : "#0891b2"}
                        stroke={payload.isCurrent ? "#fff" : "none"}
                        strokeWidth={payload.isCurrent ? 2 : 0}
                      />
                    )
                  }}
                />
                {isCurrentYear && (
                  <Line 
                    type="monotone" 
                    dataKey="budgeted" 
                    stroke="#94a3b8" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Budgeted PTO"
                    dot={false}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            
            {/* Budget input boxes positioned below chart at X-axis for current/future months */}
            {isCurrentYear && (
              <div className="relative" style={{ marginTop: '-50px', paddingBottom: '10px' }}>
                <div className="flex justify-around">
                  {chartData.map((item: any, index: number) => {
                    const isFutureOrCurrent = item.isFuture || item.isCurrent
                    return (
                      <div key={item.month} className="flex flex-col items-center" style={{ width: `${100 / chartData.length}%` }}>
                        {isFutureOrCurrent ? (
                          <Input
                            id={`budget-${item.month}`}
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="0"
                            value={budgetedPTO[item.month] || ''}
                            onChange={(e) => handleBudgetChange(item.month, e.target.value)}
                            className="h-7 text-xs w-14 text-center px-1"
                          />
                        ) : (
                          <div className="h-7" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
