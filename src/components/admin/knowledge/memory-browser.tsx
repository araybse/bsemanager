'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, Filter, ChevronLeft, ChevronRight, Download, 
  LayoutGrid, List, Clock, FileText, X 
} from 'lucide-react';

interface Memory {
  id: number;
  thread_id: string;
  file_project: string;
  suggested_project: string | null;
  subject: string | null;
  preview: string | null;
  processed_date: string | null;
  status: string;
  issue_type: string;
  metadata: {
    confidence?: number;
    narrative?: {
      summary?: string;
      key_takeaways?: string[];
    };
    sourceEmails?: Array<{
      subject?: string;
      from?: string;
      date?: string;
    }>;
    participants?: string[];
  };
  created_at: string;
}

interface MemoriesResponse {
  memories: Memory[];
  total: number;
  filtered: number;
}

export function KnowledgeMemoryBrowser() {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confidenceMin, setConfidenceMin] = useState<number>(0);
  const [confidenceMax, setConfidenceMax] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'table' | 'card' | 'timeline'>('table');
  const [page, setPage] = useState(1);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const itemsPerPage = 50;
  
  const { data, isLoading } = useQuery<MemoriesResponse>({
    queryKey: ['knowledge-memories', search, projectFilter, statusFilter, confidenceMin, confidenceMax, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        project: projectFilter,
        status: statusFilter,
        confidence_min: confidenceMin.toString(),
        confidence_max: confidenceMax.toString(),
        page: page.toString(),
        limit: itemsPerPage.toString()
      });
      const res = await fetch(`/api/knowledge/memories?${params}`);
      if (!res.ok) throw new Error('Failed to fetch memories');
      return res.json();
    },
    refetchInterval: 60000
  });
  
  const clearFilters = () => {
    setSearch('');
    setProjectFilter('all');
    setStatusFilter('all');
    setConfidenceMin(0);
    setConfidenceMax(100);
    setPage(1);
  };
  
  const handleExport = async (format: 'csv' | 'json') => {
    const params = new URLSearchParams({
      search,
      project: projectFilter,
      status: statusFilter,
      confidence_min: confidenceMin.toString(),
      confidence_max: confidenceMax.toString(),
      format
    });
    window.location.href = `/api/knowledge/memories/export?${params}`;
  };
  
  const viewDetails = (memory: Memory) => {
    setSelectedMemory(memory);
    setDetailsOpen(true);
  };
  
  const getConfidenceBadge = (confidence: number | undefined) => {
    if (!confidence) return <Badge variant="outline">Unknown</Badge>;
    if (confidence >= 80) return <Badge className="bg-green-500">High ({confidence}%)</Badge>;
    if (confidence >= 60) return <Badge variant="secondary">Medium ({confidence}%)</Badge>;
    return <Badge variant="destructive">Low ({confidence}%)</Badge>;
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'reassigned':
        return <Badge className="bg-blue-500">Reassigned</Badge>;
      case 'deleted':
        return <Badge variant="destructive">Deleted</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };
  
  const totalPages = Math.ceil((data?.filtered || 0) / itemsPerPage);
  const hasActiveFilters = search || projectFilter !== 'all' || statusFilter !== 'all' || confidenceMin > 0 || confidenceMax < 100;
  
  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search across subject, content, participants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Filter Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Project</label>
              <Input
                placeholder="e.g., 24-01"
                value={projectFilter === 'all' ? '' : projectFilter}
                onChange={(e) => setProjectFilter(e.target.value || 'all')}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="reassigned">Reassigned</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Min Confidence</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={confidenceMin}
                onChange={(e) => setConfidenceMin(Number(e.target.value))}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Max Confidence</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={confidenceMax}
                onChange={(e) => setConfidenceMax(Number(e.target.value))}
              />
            </div>
          </div>
          
          {/* Filter Actions */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                Filters applied
              </span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Stats & View Mode */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {data?.filtered.toLocaleString() || 0} of {data?.total.toLocaleString() || 0} memories
        </div>
        
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <TabsList>
              <TabsTrigger value="table">
                <List className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="card">
                <LayoutGrid className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <Clock className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
      
      {/* Memories Display */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : data?.memories && data.memories.length > 0 ? (
            <>
              {viewMode === 'table' && (
                <div className="space-y-2">
                  {data.memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="flex items-start gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => viewDetails(memory)}
                    >
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{memory.file_project}</Badge>
                          {getStatusBadge(memory.status)}
                          {getConfidenceBadge(memory.metadata?.confidence)}
                        </div>
                        
                        <div className="font-medium text-sm mb-1">{memory.subject || 'No subject'}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {memory.preview || memory.metadata?.narrative?.summary || 'No preview'}
                        </div>
                        
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(memory.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {viewMode === 'card' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.memories.map((memory) => (
                    <Card
                      key={memory.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => viewDetails(memory)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{memory.file_project}</Badge>
                          {getStatusBadge(memory.status)}
                        </div>
                        <CardTitle className="text-sm line-clamp-2">
                          {memory.subject || 'No subject'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs text-muted-foreground line-clamp-3 mb-3">
                          {memory.preview || memory.metadata?.narrative?.summary || 'No preview'}
                        </div>
                        <div className="flex items-center justify-between">
                          {getConfidenceBadge(memory.metadata?.confidence)}
                          <span className="text-xs text-muted-foreground">
                            {new Date(memory.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {viewMode === 'timeline' && (
                <div className="space-y-4">
                  {data.memories.map((memory, index) => (
                    <div key={memory.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        {index < data.memories.length - 1 && (
                          <div className="w-0.5 h-full bg-border mt-2" />
                        )}
                      </div>
                      
                      <div
                        className="flex-1 pb-8 cursor-pointer"
                        onClick={() => viewDetails(memory)}
                      >
                        <div className="text-xs text-muted-foreground mb-1">
                          {new Date(memory.created_at).toLocaleDateString()}
                        </div>
                        
                        <Card className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{memory.file_project}</Badge>
                              {getStatusBadge(memory.status)}
                              {getConfidenceBadge(memory.metadata?.confidence)}
                            </div>
                            <CardTitle className="text-sm">
                              {memory.subject || 'No subject'}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {memory.preview || memory.metadata?.narrative?.summary || 'No preview'}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              No memories found
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Memory Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedMemory && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 pr-4">
                {/* Subject */}
                <div>
                  <div className="text-sm font-medium mb-1">Subject</div>
                  <div className="text-sm text-muted-foreground">{selectedMemory.subject || 'No subject'}</div>
                </div>
                
                {/* Meta Info */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <div className="text-sm font-medium mb-1">Project</div>
                    <Badge variant="outline">{selectedMemory.file_project}</Badge>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium mb-1">Status</div>
                    {getStatusBadge(selectedMemory.status)}
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium mb-1">Confidence</div>
                    {getConfidenceBadge(selectedMemory.metadata?.confidence)}
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium mb-1">Issue Type</div>
                    <Badge variant="secondary">{selectedMemory.issue_type}</Badge>
                  </div>
                </div>
                
                <Separator />
                
                {/* Summary */}
                <div>
                  <div className="text-sm font-medium mb-2">Summary</div>
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                    {selectedMemory.metadata?.narrative?.summary || selectedMemory.preview || 'No summary available'}
                  </div>
                </div>
                
                {/* Key Takeaways */}
                {selectedMemory.metadata?.narrative?.key_takeaways && selectedMemory.metadata.narrative.key_takeaways.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Key Takeaways</div>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      {selectedMemory.metadata.narrative.key_takeaways.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Participants */}
                {selectedMemory.metadata?.participants && selectedMemory.metadata.participants.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Participants</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedMemory.metadata.participants.join(', ')}
                    </div>
                  </div>
                )}
                
                {/* Source Emails */}
                {selectedMemory.metadata?.sourceEmails && selectedMemory.metadata.sourceEmails.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Source Emails ({selectedMemory.metadata.sourceEmails.length})</div>
                    <div className="space-y-2">
                      {selectedMemory.metadata.sourceEmails.slice(0, 5).map((email, i) => (
                        <div key={i} className="text-xs text-muted-foreground bg-muted p-2 rounded">
                          <div className="font-medium">{email.subject}</div>
                          <div>From: {email.from}</div>
                          <div>{email.date ? new Date(email.date).toLocaleDateString() : 'No date'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Separator />
                
                {/* Metadata */}
                <div>
                  <div className="text-sm font-medium mb-2">Technical Details</div>
                  <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded">
                    <div>ID: {selectedMemory.id}</div>
                    <div>Thread ID: {selectedMemory.thread_id}</div>
                    <div>Created: {new Date(selectedMemory.created_at).toLocaleString()}</div>
                    {selectedMemory.processed_date && (
                      <div>Processed: {new Date(selectedMemory.processed_date).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
