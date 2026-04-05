'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export default function CostsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  
  // Summary data
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['costs', 'summary', period],
    queryFn: () => fetch(`/api/costs/summary?period=${period}`).then(r => r.json()),
    refetchInterval: 60000
  });
  
  // Trends data
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['costs', 'trends'],
    queryFn: () => fetch('/api/costs/trends?days=30').then(r => r.json())
  });
  
  // Stats data
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['costs', 'stats'],
    queryFn: () => fetch('/api/costs/stats').then(r => r.json())
  });
  
  // Recent activity
  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ['costs', 'recent'],
    queryFn: () => fetch('/api/costs/recent?limit=50').then(r => r.json())
  });
  
  const handleExport = (format: 'csv' | 'json') => {
    const params = new URLSearchParams({ format });
    window.location.href = `/api/costs/export?${params}`;
  };
  
  // Chart data
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
        name: name.split('/').pop() || name, // Show only model name, not provider
        value: typeof value === 'number' ? value : 0 
      }))
    : [];
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Cost Analytics</h1>
          <p className="text-muted-foreground">
            Detailed breakdown of AI API spending
          </p>
        </div>
        
        <div className="flex gap-2">
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
          
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
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
    </div>
  );
}
