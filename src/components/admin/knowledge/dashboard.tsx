'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, TrendingUp, AlertTriangle, CheckCircle, Database, DollarSign, Mail, MessageSquare } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { AutoProcessorStatusCard } from '@/components/knowledge/auto-processor-status-card';

interface KnowledgeStats {
  totalMemories: number;
  projectsCovered: number;
  pendingReviews: number;
  avgConfidence: number;
  byProject: Record<string, number>;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  timeline: Array<{
    date: string;
    count: number;
  }>;
  topContributors: Array<{
    email: string;
    count: number;
  }>;
  totalEmails: number;
  totalThreads: number;
  storageUsed: string;
  apiCost: number;
  recentActivity: Array<{
    id: number;
    thread_id: string;
    file_project: string;
    subject: string;
    preview: string;
    metadata: any;
    created_at: string;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

export function KnowledgeDashboard() {
  const { data: stats, isLoading } = useQuery<KnowledgeStats>({
    queryKey: ['knowledge-stats'],
    queryFn: () => fetch('/api/knowledge/stats').then(r => {
      if (!r.ok) throw new Error('Failed to fetch stats');
      return r.json();
    }),
    refetchInterval: 60000
  });
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  const confidenceData = stats ? [
    { name: 'High (80%+)', value: stats.confidenceDistribution.high, color: '#00C49F' },
    { name: 'Medium (60-79%)', value: stats.confidenceDistribution.medium, color: '#FFBB28' },
    { name: 'Low (<60%)', value: stats.confidenceDistribution.low, color: '#FF8042' }
  ] : [];
  
  const projectData = stats?.byProject 
    ? Object.entries(stats.byProject)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, value]) => ({ name, value }))
    : [];
  
  const getConfidenceBadge = (metadata: any) => {
    const confidence = metadata?.confidence || 0;
    if (confidence >= 80) return <Badge variant="default" className="bg-green-500">High</Badge>;
    if (confidence >= 60) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="destructive">Low</Badge>;
  };
  
  return (
    <div className="space-y-6">
      {/* Auto-Processor Status - Top of page */}
      <AutoProcessorStatusCard />
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Total Memories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMemories.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Processed entries</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Projects Covered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.projectsCovered || 0}</div>
            <p className="text-xs text-muted-foreground">Unique projects</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Pending Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats?.pendingReviews.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Avg Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgConfidence.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">AI confidence score</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Processing Timeline (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.timeline && stats.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.timeline}>
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
                    labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" name="Memories Processed" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No timeline data available
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Confidence Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Confidence Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {confidenceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={confidenceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {confidenceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No confidence data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Projects by Memories</CardTitle>
          </CardHeader>
          <CardContent>
            {projectData.length > 0 ? (
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
                  <Tooltip />
                  <Bar dataKey="value" fill="#82ca9d" name="Memories" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No project data available
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Processing Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Emails</span>
                </div>
                <span className="font-bold">{stats?.totalEmails.toLocaleString() || 0}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Threads</span>
                </div>
                <span className="font-bold">{stats?.totalThreads.toLocaleString() || 0}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Storage Used</span>
                </div>
                <span className="font-bold">{stats?.storageUsed || '0 MB'}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">API Cost (Extraction)</span>
                </div>
                <span className="font-bold">${stats?.apiCost.toFixed(2) || '0.00'}</span>
              </div>
              
              {stats?.topContributors && stats.topContributors.length > 0 && (
                <div className="pt-4 border-t">
                  <div className="text-sm font-medium mb-2">Top Contributors</div>
                  <div className="space-y-2">
                    {stats.topContributors.slice(0, 5).map((contributor, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-[200px]">
                          {contributor.email}
                        </span>
                        <span className="font-medium">{contributor.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity (Last 20 Processed)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <Brain className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{item.file_project}</Badge>
                      {getConfidenceBadge(item.metadata)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="font-medium text-sm mb-1 truncate">{item.subject || 'No subject'}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{item.preview || 'No preview'}</div>
                  </div>
                </div>
              ))}
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
