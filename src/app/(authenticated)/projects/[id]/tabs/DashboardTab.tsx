'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TabsContent } from '@/components/ui/tabs'
import { formatCurrency, formatHours } from '@/lib/utils/format'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
  Line,
  ComposedChart,
} from 'recharts'

const PIE_COLORS = [
  '#384eaa', // IRIS Blue (primary)
  '#111827', // Black
  '#0891b2', // Cyan (cool, professional)
  '#475569', // Slate Gray
  '#7c3aed', // Deep Purple (royal, sophisticated)
  '#0f766e', // Teal (complements blue)
  '#581c87', // Dark Purple
  '#334155', // Dark Slate
  '#8b5cf6', // Violet (softer purple)
  '#84CC16', // Lime
  '#06B6D4', // Cyan
  '#A855F7', // Violet
]

export interface PhaseData {
  id: number
  phase_code: string
  phase_name: string
}

export interface PhaseChartEntry {
  name: string
  fullName: string
  contract: number
  billed: number
  remaining: number
}

export interface TimeDistributionEntry {
  name: string
  hours: number
}

export interface PerformanceDataPoint {
  monthLabel: string
  invoiceAmount: number
  billableAmount: number
}

export interface PerformanceMultiplierCardProps {
  projectId: number
  phases: PhaseData[]
}

export interface PerformanceHistoryChartContentProps {
  projectId: number
  phaseFilter?: string
}

export interface DashboardTabProps {
  projectId: number
  // Summary card data
  totalFee: number
  totalRevenue: number
  totalCost: number
  bseLaborOnly: number
  totalExpenses: number
  projectMultiplier: number
  // Phase chart
  phaseChartData: PhaseChartEntry[]
  loadingPhases: boolean
  // Time distribution
  timeDistributionData: TimeDistributionEntry[]
  totalHours: number
  loadingAllTime: boolean
  timeDistributionView: 'employee' | 'phase'
  setTimeDistributionView: (value: 'employee' | 'phase') => void
  // Performance charts
  performanceOverTime: PerformanceDataPoint[]
  loadingPerformanceOverTime: boolean
  selectedPhaseFilter: string
  setSelectedPhaseFilter: (value: string) => void
  phases: PhaseData[]
  // Performance multiplier components (passed from parent)
  PerformanceMultiplierCard: React.ComponentType<PerformanceMultiplierCardProps>
  PerformanceHistoryChartContent: React.ComponentType<PerformanceHistoryChartContentProps>
}

export function DashboardTab({
  projectId,
  totalFee,
  totalRevenue,
  totalCost,
  bseLaborOnly,
  totalExpenses,
  projectMultiplier,
  phaseChartData,
  loadingPhases,
  timeDistributionData,
  totalHours,
  loadingAllTime,
  timeDistributionView,
  setTimeDistributionView,
  performanceOverTime,
  loadingPerformanceOverTime,
  selectedPhaseFilter,
  setSelectedPhaseFilter,
  phases,
  PerformanceMultiplierCard,
  PerformanceHistoryChartContent,
}: DashboardTabProps) {
  return (
    <TabsContent value="dashboard" className="mt-4">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Contract</CardDescription>
              <CardTitle className="text-xl">{formatCurrency(totalFee)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className="text-xl">{formatCurrency(totalRevenue)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Cost</CardDescription>
              <CardTitle className="text-xl group relative cursor-help">
                {formatCurrency(totalCost)}
                <div className="invisible group-hover:visible absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64 z-10">
                  <div className="space-y-1 text-sm font-normal">
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-600">Labor:</span>
                      <span className="font-medium">{formatCurrency(bseLaborOnly)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-600">Expenses:</span>
                      <span className="font-medium">{formatCurrency(totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between gap-4 pt-1 border-t">
                      <span className="font-semibold">Total:</span>
                      <span className="font-semibold">{formatCurrency(totalCost)}</span>
                    </div>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Project Multiplier</CardDescription>
              <CardTitle className="text-xl group relative cursor-help">
                {projectMultiplier > 0 ? projectMultiplier.toFixed(2) + 'x' : '—'}
                {projectMultiplier > 0 && (
                  <div className="invisible group-hover:visible absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64 z-10">
                    <div className="space-y-1 text-sm font-normal">
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-600">Total Revenue:</span>
                        <span className="font-medium">{formatCurrency(totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-600">Total Cost:</span>
                        <span className="font-medium">{formatCurrency(totalCost)}</span>
                      </div>
                      <div className="flex justify-between gap-4 pt-1 border-t">
                        <span className="font-semibold">Multiplier:</span>
                        <span className="font-semibold">{projectMultiplier.toFixed(2)}x</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <PerformanceMultiplierCard projectId={projectId} phases={phases || []} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Phase Progress Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Phase Progress</CardTitle>
              <CardDescription>Contract amount vs billed-to-date by phase</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPhases || loadingAllTime ? (
                <Skeleton className="h-[300px] w-full" />
              ) : phaseChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={phaseChartData} layout="vertical" margin={{ left: 20, right: 140 }}>
                    <CartesianGrid horizontal={false} vertical={false} />
                    <XAxis type="number" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={60} interval={0} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                              <p className="font-semibold mb-2">{data.fullName}</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600">Billed:</span>
                                  <span className="font-medium">{formatCurrency(data.billed)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600">Contract:</span>
                                  <span className="font-medium">{formatCurrency(data.contract)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600">Remaining:</span>
                                  <span className="font-medium">{formatCurrency(data.remaining)}</span>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="billed" stackId="progress" fill="#000000" name="Billed" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="remaining" stackId="progress" fill="#d4d4d4" name="Remaining" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="fullName" position="right" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No phase data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time Distribution */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Time Distribution</CardTitle>
                  <CardDescription>
                    Total hours by {timeDistributionView} ({formatHours(totalHours)} total)
                  </CardDescription>
                </div>
                <Select
                  value={timeDistributionView}
                  onValueChange={(value) =>
                    setTimeDistributionView(value as 'employee' | 'phase')
                  }
                >
                  <SelectTrigger className="h-8 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="phase">Phase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAllTime ? (
                <Skeleton className="h-[300px] w-full" />
              ) : timeDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={timeDistributionData}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="40%"
                      outerRadius={80}
                    >
                      {timeDistributionData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatHours(Number(value))} />
                    <Legend verticalAlign="bottom" height={60} wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No time entry data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Project Performance Charts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Project Performance Over Time</CardTitle>
                <CardDescription>Monthly performance and cumulative multiplier by phase</CardDescription>
              </div>
              <Select value={selectedPhaseFilter} onValueChange={setSelectedPhaseFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  {(phases || []).map((phase) => (
                    <SelectItem key={phase.phase_code} value={phase.phase_name}>
                      {phase.phase_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Monthly Performance Chart */}
            <div>
              <h3 className="text-sm font-medium mb-4">Monthly Invoiced Revenue & Billable Amounts</h3>
              {loadingPerformanceOverTime ? (
                <Skeleton className="h-[300px] w-full" />
              ) : performanceOverTime && performanceOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={performanceOverTime} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="monthLabel" />
                    <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value) || 0)}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="invoiceAmount" fill="#000000" name="Invoiced" />
                    <Line
                      type="monotone"
                      dataKey="billableAmount"
                      stroke="#384eaa"
                      strokeWidth={2}
                      name="Billable"
                      dot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No performance data available for this project
                </div>
              )}
            </div>

            {/* Performance Multiplier Chart */}
            <div>
              <h3 className="text-sm font-medium mb-4">Cumulative Performance Multiplier</h3>
              <PerformanceHistoryChartContent projectId={projectId} phaseFilter={selectedPhaseFilter} />
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  )
}
