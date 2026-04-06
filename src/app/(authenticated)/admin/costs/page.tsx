'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Download, DollarSign, TrendingUp, Activity, Zap, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const DAILY_BUDGET = 150;
const DAILY_ALERT_THRESHOLD = 200;
const REFRESH_INTERVAL = 5000; // 5 seconds for true real-time

// Helper to format date in EST
function formatDateEST(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    ...options
  });
}

function formatTimeEST(dateString: string): string {
  return formatDateEST(dateString, { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function formatDateTimeEST(dateString: string): string {
  return formatDateEST(dateString, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export default function CostsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [activeTab, setActiveTab] = useState<'realtime' | 'historical'>('realtime');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Real-time data (today's costs) - 5 second polling
  const { data: realtime, isLoading: realtimeLoading, refetch: refetchRealtime } = useQuery({
    queryKey: ['costs', 'realtime', 'today'],
    queryFn: async () => {
      const res = await fetch('/api/admin/api-costs-realtime?action=today');
      setLastUpdated(new Date());
      return res.json();
    },
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false, // Only poll when tab is active
    enabled: activeTab === 'realtime'
  });
  
  // Real-time summary (month totals) - 5 second polling
  const { data: realtimeSummary, isLoading: realtimeSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['costs', 'realtime', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/api-costs-realtime?action=summary');
      return res.json();
    },
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
    enabled: activeTab === 'realtime'
  });
  
  // Monthly historical data (CSV backfill)
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['costs', 'monthly'],
    queryFn: () => fetch('/api/costs/monthly').then(r => r.json()),
    enabled: activeTab === 'historical'
  });
  
  // Historical summary (current period)
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['costs', 'summary', period],
    queryFn: () => fetch(`/api/costs/summary?period=${period}`).then(r => r.json()),
    refetchInterval: 60000,
    enabled: activeTab === 'historical'
  });
  
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['costs', 'trends'],
    queryFn: () => fetch('/api/costs/trends?days=90').then(r => r.json()),
    enabled: activeTab === 'historical'
  });
  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['costs', 'stats'],
    queryFn: () => fetch('/api/costs/stats').then(r => r.json()),
    enabled: activeTab === 'historical'
  });
  
  const handleExport = (format: 'csv' | 'json') => {
    const params = new URLSearchParams({ format });
    window.location.href = `/api/costs/export?${params}`;
  };
  
  const handleManualRefresh = () => {
    refetchRealtime();
    refetchSummary();
  };
  
  // Real-time chart data
  const realtimeAgentData = realtime?.by_agent 
    ? Object.entries(realtime.by_agent).map(([name, data]: [string, any]) => ({ 
        name, 
        cost: data.cost || 0,
        tokens: data.tokens || 0
      }))
    : [];
  
  const realtimeModelData = realtime?.by_model
    ? Object.entries(realtime.by_model).map(([name, data]: [string, any]) => ({
        name: name.split('/').pop() || name,
        cost: data.cost || 0,
        tokens: data.tokens || 0
      }))
    : [];
  
  const hourlyData = realtime?.hourly_breakdown || [];
  
  // Historical monthly chart data
  const monthlyChartData = monthlyData?.monthly || [];
  
  // Model breakdown for historical
  const modelData = monthlyData?.by_model
    ? Object.entries(monthlyData.by_model)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([name, value]) => ({ 
          name: name,
          value: typeof value === 'number' ? parseFloat(value.toFixed(2)) : 0 
        }))
    : [];
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7c7c'];
  
  // Budget calculations
  const todaysCost = realtime?.total_cost || 0;
  const budgetPercentage = (todaysCost / DAILY_BUDGET) * 100;
  const isOverBudget = todaysCost > DAILY_BUDGET;
  const isAlertLevel = todaysCost > DAILY_ALERT_THRESHOLD;
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">API Cost Tracking</h1>
        <div className="flex items-center gap-2">
          {activeTab === 'realtime' && (
            <Button variant="ghost" size="sm" onClick={handleManualRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="realtime" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Real-Time
          </TabsTrigger>
          <TabsTrigger value="historical" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Historical
          </TabsTrigger>
        </TabsList>
        
        {/* REAL-TIME TAB */}
        <TabsContent value="realtime" className="space-y-6 mt-6">
          
          {/* Today's Spending Widget */}
          <Card className={`transition-all duration-300 ${isAlertLevel ? 'border-red-500 border-2' : isOverBudget ? 'border-yellow-500 border-2' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Today's Spending</span>
                <div className="flex items-center gap-2">
                  {isAlertLevel && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Alert Level
                    </Badge>
                  )}
                  {isOverBudget && !isAlertLevel && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Over Budget
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    Updated {formatTimeEST(lastUpdated.toISOString())} EST
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {realtimeLoading ? (
                <div className="h-24 w-full bg-muted animate-pulse rounded" />
              ) : (
                <div className="space-y-4">
                  <div className="text-5xl font-bold transition-all duration-500">
                    ${todaysCost.toFixed(2)}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Budget Progress</span>
                      <span className={isOverBudget ? 'text-red-500 font-semibold' : ''}>
                        {budgetPercentage.toFixed(0)}% of ${DAILY_BUDGET}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          isAlertLevel ? 'bg-red-500' : isOverBudget ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Sessions</p>
                      <p className="text-xl font-semibold">{realtime?.session_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Tokens</p>
                      <p className="text-xl font-semibold">{(realtime?.total_tokens || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg/Session</p>
                      <p className="text-xl font-semibold">
                        ${realtime?.session_count ? (todaysCost / realtime.session_count).toFixed(2) : '0.00'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Month Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Month Total (Real-Time)</CardTitle>
              </CardHeader>
              <CardContent>
                {realtimeSummaryLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold transition-all duration-500">
                      ${realtimeSummary?.month_total?.toFixed(2) || '0.00'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {realtimeSummary?.days_tracked || 0} days tracked
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
              </CardHeader>
              <CardContent>
                {realtimeSummaryLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      ${realtimeSummary?.daily_average?.toFixed(2) || '0.00'}
                    </div>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Projected Month</CardTitle>
              </CardHeader>
              <CardContent>
                {realtimeSummaryLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      ${realtimeSummary?.daily_average 
                        ? (realtimeSummary.daily_average * 30).toFixed(2) 
                        : '0.00'}
                    </div>
                    <p className="text-xs text-muted-foreground">Estimated</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Hourly Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Hourly Breakdown (EST)</CardTitle>
              </CardHeader>
              <CardContent>
                {realtimeLoading ? (
                  <div className="h-[300px] w-full bg-muted animate-pulse rounded" />
                ) : hourlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                      <Line 
                        type="monotone" 
                        dataKey="cost" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        animationDuration={300}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No activity today yet
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Agent Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>By Agent</CardTitle>
              </CardHeader>
              <CardContent>
                {realtimeLoading ? (
                  <div className="h-[300px] w-full bg-muted animate-pulse rounded" />
                ) : realtimeAgentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie
                        data={realtimeAgentData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: $${Number(value).toFixed(2)}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="cost"
                        animationDuration={300}
                      >
                        {realtimeAgentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                    </RechartsPie>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No agent data yet
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Model Breakdown */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>By Model</CardTitle>
              </CardHeader>
              <CardContent>
                {realtimeLoading ? (
                  <div className="h-[300px] w-full bg-muted animate-pulse rounded" />
                ) : realtimeModelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={realtimeModelData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                      <Bar dataKey="cost" fill="#82ca9d" animationDuration={300} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No model data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Live Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Live Activity Feed</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <Badge variant="outline">Auto-refreshing every 5s</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {realtimeLoading ? (
                <div className="h-64 w-full bg-muted animate-pulse rounded" />
              ) : realtime?.sessions && realtime.sessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Time (EST)</th>
                        <th className="text-left p-2">Agent</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Model</th>
                        <th className="text-right p-2">Tokens</th>
                        <th className="text-right p-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realtime.sessions.map((session: any, index: number) => (
                        <tr 
                          key={session.id} 
                          className={`border-b hover:bg-muted/50 transition-all duration-300 ${index === 0 ? 'bg-green-50 dark:bg-green-950/20' : ''}`}
                        >
                          <td className="p-2 text-xs">
                            {formatTimeEST(session.created_at)}
                          </td>
                          <td className="p-2">
                            <Badge variant="outline">{session.agent_name || 'Unknown'}</Badge>
                          </td>
                          <td className="p-2 text-xs">{session.session_type || 'main'}</td>
                          <td className="p-2 text-xs">{session.model.split('/').pop()}</td>
                          <td className="p-2 text-right text-xs">
                            {session.total_tokens.toLocaleString()}
                          </td>
                          <td className="p-2 text-right font-mono">
                            ${parseFloat(session.estimated_cost_usd).toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No activity today yet
                </div>
              )}
            </CardContent>
          </Card>
          
        </TabsContent>
        
        {/* HISTORICAL TAB */}
        <TabsContent value="historical" className="space-y-6 mt-6">
          
          {/* Monthly Overview - Key Feature */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="text-xl">Monthly Cost Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyLoading ? (
                <div className="h-[350px] w-full bg-muted animate-pulse rounded" />
              ) : monthlyChartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="monthName" 
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip 
                        formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cost']}
                        labelStyle={{ fontWeight: 'bold' }}
                      />
                      <Bar 
                        dataKey="cost" 
                        fill="#8884d8" 
                        name="Monthly Cost"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  
                  {/* Monthly breakdown table */}
                  <div className="mt-6 border-t pt-4">
                    <h4 className="font-semibold mb-3">Monthly Breakdown</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {monthlyChartData.map((m: any) => (
                        <div key={m.month} className="bg-muted/50 rounded-lg p-3">
                          <div className="text-sm text-muted-foreground">{m.monthName}</div>
                          <div className="text-xl font-bold">${m.cost.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                      <div className="text-sm text-muted-foreground">Total All-Time</div>
                      <div className="text-3xl font-bold">${monthlyData?.total?.toFixed(2) || '0.00'}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {monthlyData?.record_count || 0} records from CSV import
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  No historical data available
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Model Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Cost by Model (All Time)</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyLoading ? (
                <div className="h-[300px] w-full bg-muted animate-pulse rounded" />
              ) : modelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={modelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 11 }} 
                      width={120}
                    />
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                    <Bar dataKey="value" fill="#00C49F" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No model data available
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Daily Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Spending Trend (Last 90 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="h-[300px] w-full bg-muted animate-pulse rounded" />
              ) : trends?.trend && trends.trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => {
                        const date = new Date(value + 'T00:00:00');
                        return formatDateEST(date.toISOString(), { month: 'numeric', day: 'numeric' });
                      }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      formatter={(value) => `$${Number(value).toFixed(2)}`}
                      labelFormatter={(label) => formatDateEST(label + 'T00:00:00', { month: 'long', day: 'numeric', year: 'numeric' })}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cost" 
                      stroke="#8884d8" 
                      name="Daily Cost" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No trend data available
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total All-Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      ${stats?.totalSpend?.toFixed(2) || '0.00'}
                    </div>
                    <p className="text-xs text-muted-foreground">From CSV import</p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Total Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {stats?.totalCalls?.toLocaleString() || '0'}
                    </div>
                    <p className="text-xs text-muted-foreground">API call records</p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Cost/Record</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      ${stats?.avgCost?.toFixed(4) || '0.0000'}
                    </div>
                    <p className="text-xs text-muted-foreground">Per record</p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Model</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-lg font-bold truncate">
                      {stats?.mostExpensiveProject?.project || 'N/A'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ${stats?.mostExpensiveProject?.cost?.toFixed(2) || '0.00'}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          
        </TabsContent>
      </Tabs>
    </div>
  );
}
