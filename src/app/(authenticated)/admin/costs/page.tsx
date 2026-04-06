'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Download, DollarSign, TrendingUp, Activity, Zap, AlertTriangle, Clock } from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const DAILY_BUDGET = 150;
const DAILY_ALERT_THRESHOLD = 200;

export default function CostsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [activeTab, setActiveTab] = useState<'realtime' | 'historical'>('realtime');
  
  // Real-time data (today's costs)
  const { data: realtime, isLoading: realtimeLoading } = useQuery({
    queryKey: ['costs', 'realtime', 'today'],
    queryFn: () => fetch('/api/admin/api-costs-realtime?action=today').then(r => r.json()),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    enabled: activeTab === 'realtime'
  });
  
  // Real-time summary (month totals)
  const { data: realtimeSummary, isLoading: realtimeSummaryLoading } = useQuery({
    queryKey: ['costs', 'realtime', 'summary'],
    queryFn: () => fetch('/api/admin/api-costs-realtime?action=summary').then(r => r.json()),
    refetchInterval: 60000,
    enabled: activeTab === 'realtime'
  });
  
  // Historical data (CSV backfill data)
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['costs', 'summary', period],
    queryFn: () => fetch(`/api/costs/summary?period=${period}`).then(r => r.json()),
    refetchInterval: 60000,
    enabled: activeTab === 'historical'
  });
  
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['costs', 'trends'],
    queryFn: () => fetch('/api/costs/trends?days=30').then(r => r.json()),
    enabled: activeTab === 'historical'
  });
  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['costs', 'stats'],
    queryFn: () => fetch('/api/costs/stats').then(r => r.json()),
    enabled: activeTab === 'historical'
  });
  
  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ['costs', 'recent'],
    queryFn: () => fetch('/api/costs/recent?limit=50').then(r => r.json()),
    enabled: activeTab === 'historical'
  });
  
  const handleExport = (format: 'csv' | 'json') => {
    const params = new URLSearchParams({ format });
    window.location.href = `/api/costs/export?${params}`;
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
  
  // Historical chart data
  const categoryData = summary?.byCategory 
    ? Object.entries(summary.byCategory).map(([name, value]) => ({ 
        name, 
        value: typeof value === 'number' ? value : 0 
      }))
    : [];
  
  const projectData = summary?.byProject
    ? Object.entries(summary.byProject)
        .sort(([, a], [, b]) => (typeof b === 'number' ? b : 0) - (typeof a === 'number' ? a : 0))
        .slice(0, 10)
        .map(([name, value]) => ({ 
          name, 
          value: typeof value === 'number' ? value : 0 
        }))
    : [];
  
  const modelData = stats?.byModel
    ? Object.entries(stats.byModel).map(([name, value]) => ({ 
        name: name.split('/').pop() || name,
        value: typeof value === 'number' ? value : 0 
      }))
    : [];
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];
  
  // Budget calculations
  const todaysCost = realtime?.total_cost || 0;
  const budgetPercentage = (todaysCost / DAILY_BUDGET) * 100;
  const isOverBudget = todaysCost > DAILY_BUDGET;
  const isAlertLevel = todaysCost > DAILY_ALERT_THRESHOLD;
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">API Cost Tracking</h1>
        <Button variant="outline" onClick={() => handleExport('csv')}>
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
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
          <Card className={isAlertLevel ? 'border-red-500 border-2' : isOverBudget ? 'border-yellow-500 border-2' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Today's Spending</span>
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
              </CardTitle>
            </CardHeader>
            <CardContent>
              {realtimeLoading ? (
                <div className="h-24 w-full bg-muted animate-pulse rounded" />
              ) : (
                <div className="space-y-4">
                  <div className="text-5xl font-bold">
                    ${todaysCost.toFixed(2)}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Budget Progress</span>
                      <span className={isOverBudget ? 'text-red-500 font-semibold' : ''}>
                        {budgetPercentage.toFixed(0)}% of ${DAILY_BUDGET}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all ${
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
                <CardTitle className="text-sm font-medium">Month Total</CardTitle>
              </CardHeader>
              <CardContent>
                {realtimeSummaryLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
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
                <CardTitle>Hourly Breakdown</CardTitle>
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
                      <Line type="monotone" dataKey="cost" stroke="#8884d8" strokeWidth={2} />
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
                        label={(entry) => `${entry.name}: $${entry.cost.toFixed(2)}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="cost"
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
                      <Bar dataKey="cost" fill="#82ca9d" />
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
                <Badge variant="outline">Auto-refreshing</Badge>
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
                        <th className="text-left p-2">Time</th>
                        <th className="text-left p-2">Agent</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Model</th>
                        <th className="text-right p-2">Tokens</th>
                        <th className="text-right p-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realtime.sessions.map((session: any) => (
                        <tr key={session.id} className="border-b hover:bg-muted/50">
                          <td className="p-2 text-xs">
                            {new Date(session.created_at).toLocaleTimeString()}
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
          
          {/* Filter Controls */}
          <div className="flex justify-end">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="quarter">Quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Spend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      ${summary?.total?.toFixed(2) || '0.00'}
                    </div>
                    <p className="text-xs text-muted-foreground">This {period}</p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  API Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {summary?.count?.toLocaleString() || '0'}
                    </div>
                    <p className="text-xs text-muted-foreground">Total requests</p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Cost/Call</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      ${stats?.avgCost?.toFixed(4) || '0.0000'}
                    </div>
                    <p className="text-xs text-muted-foreground">Per API request</p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold flex items-center">
                      {summary?.trend > 0 ? (
                        <TrendingUp className="h-5 w-5 text-red-500 mr-2" />
                      ) : (
                        <TrendingUp className="h-5 w-5 text-green-500 mr-2 rotate-180" />
                      )}
                      {Math.abs(summary?.trend || 0).toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">vs last {period}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Trend Line Chart */}
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle>Daily Spending Trend (Last 30 Days)</CardTitle>
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
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value) => `$${Number(value).toFixed(2)}`}
                        labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="cost" 
                        stroke="#8884d8" 
                        name="Cost ($)" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Category Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Cost by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="h-[300px] w-full bg-muted animate-pulse rounded" />
                ) : categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: $${entry.value.toFixed(2)}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                    </RechartsPie>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Top Projects Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Projects by Cost</CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="h-[300px] w-full bg-muted animate-pulse rounded" />
                ) : projectData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={projectData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                      <Bar dataKey="value" fill="#82ca9d" name="Cost ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Activity Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent API Calls</CardTitle>
            </CardHeader>
            <CardContent>
              {recentLoading ? (
                <div className="h-64 w-full bg-muted animate-pulse rounded" />
              ) : recent?.costs && recent.costs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Timestamp</th>
                        <th className="text-left p-2">Operation</th>
                        <th className="text-left p-2">Model</th>
                        <th className="text-left p-2">Category</th>
                        <th className="text-right p-2">Tokens</th>
                        <th className="text-right p-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.costs.map((cost: any) => (
                        <tr key={cost.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            {new Date(cost.timestamp).toLocaleString()}
                          </td>
                          <td className="p-2">{cost.operation}</td>
                          <td className="p-2 text-xs">{cost.model}</td>
                          <td className="p-2 text-xs">
                            <span className="px-2 py-0.5 bg-primary/10 rounded-full">
                              {cost.category}
                            </span>
                          </td>
                          <td className="p-2 text-right text-xs">
                            {cost.input_tokens + cost.output_tokens}
                          </td>
                          <td className="p-2 text-right font-mono">
                            ${parseFloat(cost.cost_usd).toFixed(6)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No recent activity
                </div>
              )}
            </CardContent>
          </Card>
          
        </TabsContent>
      </Tabs>
    </div>
  );
}
