'use client'

import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

export interface PerformanceHistoryChartContentProps {
  projectId: number
  phaseFilter?: string
}

export function PerformanceHistoryChartContent({
  projectId,
  phaseFilter,
}: PerformanceHistoryChartContentProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['performance-history', projectId, phaseFilter],
    queryFn: async () => {
      const url =
        phaseFilter && phaseFilter !== 'all'
          ? `/api/projects/${projectId}/performance-history?phase=${encodeURIComponent(phaseFilter)}`
          : `/api/projects/${projectId}/performance-history?phase=all`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch performance history')
      return res.json() as Promise<{
        history: Array<{
          month: string
          monthLabel: string
          cumulativeRevenue: number
          cumulativeCost: number
          multiplier: number | null
        }>
      }>
    },
  })

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />
  }

  if (!data?.history || data.history.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No performance history available
      </div>
    )
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.history} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={(value) => `${Math.round(Number(value))}x`}
            allowDecimals={false}
            label={{ value: 'Multiplier', angle: -90, position: 'insideLeft' }}
          />
          <ReferenceLine
            y={3}
            stroke="#9ca3af"
            strokeDasharray="3 3"
            strokeWidth={2}
            label={{ value: '3.0x Target', position: 'right', fill: '#6b7280' }}
          />
          <ReferenceLine
            y={2.25}
            stroke="#ef4444"
            strokeDasharray="3 3"
            strokeWidth={2}
            label={{ value: '2.25x Baseline', position: 'right', fill: '#dc2626' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const d = payload[0].payload
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                    <p className="font-semibold mb-2">{d.monthLabel}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-600">Multiplier:</span>
                        <span className="font-medium">
                          {d.multiplier != null ? `${d.multiplier.toFixed(2)}x` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-600">Cumulative Revenue:</span>
                        <span className="font-medium">{formatCurrency(d.cumulativeRevenue)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-600">Cumulative Cost:</span>
                        <span className="font-medium">{formatCurrency(d.cumulativeCost)}</span>
                      </div>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Line
            type="monotone"
            dataKey="multiplier"
            stroke="#384eaa"
            strokeWidth={3}
            dot={{ r: 4 }}
            name="Performance Multiplier"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
