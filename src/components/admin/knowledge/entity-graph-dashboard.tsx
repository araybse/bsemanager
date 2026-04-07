'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Database, GitBranch, TrendingUp, Mail } from 'lucide-react';

interface GraphStats {
  entityCount: number;
  entityTypes: { type: string; count: number }[];
  relationshipCount: number;
  relationshipTypes: { type: string; count: number }[];
  processingStats: {
    emailsProcessed: number;
    entityResolutionRate: number;
    avgProcessingTime: number;
    lastProcessed: string;
  };
}

interface Entity {
  id: string;
  canonical_name: string;
  entity_type: string;
  confidence: number;
  attributes: any;
  created_at: string;
  updated_at: string;
}

interface EntitiesResponse {
  data: Entity[];
  count: number;
  page: number;
  limit: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658'];

export function EntityGraphDashboard() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [page, setPage] = useState(1);
  
  // Load graph stats
  const { data: stats, isLoading: statsLoading } = useQuery<GraphStats>({
    queryKey: ['knowledge-graph-stats'],
    queryFn: () => fetch('/api/knowledge/graph-stats').then(r => {
      if (!r.ok) throw new Error('Failed to fetch stats');
      return r.json();
    }),
    refetchInterval: 60000
  });
  
  // Load entities
  const { data: entitiesData, isLoading: entitiesLoading } = useQuery<EntitiesResponse>({
    queryKey: ['knowledge-entities', page, search, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '50');
      if (search) params.append('search', search);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      
      return fetch(`/api/knowledge/entities?${params}`).then(r => {
        if (!r.ok) throw new Error('Failed to fetch entities');
        return r.json();
      });
    }
  });
  
  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
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
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Entity & Relationship Graph</h2>
        <Button variant="outline">Process New Emails</Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Total Entities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.entityCount.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Deduplicated & verified</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Relationships
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.relationshipCount.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Connections mapped</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Resolution Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {((stats?.processingStats.entityResolutionRate || 0) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Entity matching accuracy</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Emails Processed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.processingStats.emailsProcessed.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg {stats?.processingStats.avgProcessingTime.toFixed(1)}s/email
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Entity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.entityTypes && stats.entityTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.entityTypes}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry: any) => `${entry.type}: ${entry.count}`}
                  >
                    {stats.entityTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No entity data available
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Relationship Types</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.relationshipTypes && stats.relationshipTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.relationshipTypes}>
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#0088FE" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No relationship data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Entity Browser */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Entity Browser</CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Search entities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {stats?.entityTypes.map(t => (
                    <SelectItem key={t.type} value={t.type}>{t.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {entitiesLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-muted-foreground">Loading entities...</div>
            </div>
          ) : entitiesData?.data && entitiesData.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Enrichments</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entitiesData.data.map(entity => (
                    <TableRow 
                      key={entity.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedEntity(entity)}
                    >
                      <TableCell className="font-medium">{entity.canonical_name}</TableCell>
                      <TableCell>
                        <Badge>{entity.entity_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={entity.confidence > 0.8 ? 'default' : 'secondary'}>
                          {(entity.confidence * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {Object.keys(entity.attributes || {}).length} fields
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(entity.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, entitiesData.count)} of {entitiesData.count} entities
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={page * 50 >= entitiesData.count}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No entities found
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Entity Details Panel */}
      {selectedEntity && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Entity Details: {selectedEntity.canonical_name}</CardTitle>
              <Button variant="ghost" onClick={() => setSelectedEntity(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <p className="mt-1">{selectedEntity.entity_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Confidence</label>
                  <p className="mt-1">{(selectedEntity.confidence * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Created</label>
                  <p className="mt-1">{new Date(selectedEntity.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Last Updated</label>
                  <p className="mt-1">{new Date(selectedEntity.updated_at).toLocaleString()}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Attributes</label>
                <pre className="mt-2 p-4 bg-muted rounded text-sm overflow-auto max-h-96">
                  {JSON.stringify(selectedEntity.attributes, null, 2)}
                </pre>
              </div>
              
              <div className="flex gap-2">
                <Button>Edit</Button>
                <Button variant="outline">Merge with...</Button>
                <Button variant="destructive">Delete</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
