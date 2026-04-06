'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, XCircle, ArrowRight, AlertTriangle, Filter, 
  ChevronLeft, ChevronRight, FileText, Trash2, Check, AlertCircle 
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { logCorrection, logApproval, logRejection } from '@/lib/feedback-capture';

interface ReviewItem {
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

interface ReviewQueueResponse {
  total: number;
  items: ReviewItem[];
}

export function KnowledgeReviewQueue() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('confidence');
  const [page, setPage] = useState(1);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [newProject, setNewProject] = useState('');
  
  const queryClient = useQueryClient();
  const itemsPerPage = 50;
  
  // Fetch review queue
  const { data, isLoading } = useQuery<ReviewQueueResponse>({
    queryKey: ['knowledge-review-queue', confidenceFilter, projectFilter, issueTypeFilter, sortBy, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        confidence: confidenceFilter,
        project: projectFilter,
        issue_type: issueTypeFilter,
        sort: sortBy,
        page: page.toString(),
        limit: itemsPerPage.toString()
      });
      const res = await fetch(`/api/knowledge/review-queue?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 60000
  });
  
  // Single item mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, newProject }: { id: number; action: string; newProject?: string }) => {
      const res = await fetch(`/api/knowledge/review-queue/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, newProject })
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-stats'] });
      setReviewModalOpen(false);
      setSelectedItem(null);
      setNewProject('');
    }
  });
  
  // Bulk mutation
  const bulkMutation = useMutation({
    mutationFn: async ({ action, ids, newProject }: { action: string; ids: number[]; newProject?: string }) => {
      const res = await fetch('/api/knowledge/review-queue/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids, newProject })
      });
      if (!res.ok) throw new Error('Bulk action failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-stats'] });
      setSelectedIds([]);
    }
  });
  
  const handleReview = (item: ReviewItem) => {
    setSelectedItem(item);
    setNewProject(item.suggested_project || '');
    setReviewModalOpen(true);
  };
  
  const handleAction = async (action: 'approve' | 'reassign' | 'delete') => {
    if (!selectedItem) return;
    
    // Log feedback for learning before executing action
    try {
      if (action === 'approve') {
        await logApproval({
          type: 'project_assignment',
          agentName: 'Sophia',
          output: { 
            project: selectedItem.file_project,
            threadId: selectedItem.thread_id 
          },
          sourceId: selectedItem.thread_id,
          confidenceWas: selectedItem.metadata?.confidence
        });
      } else if (action === 'reassign' && newProject) {
        await logCorrection({
          type: 'project_assignment',
          agentName: 'Sophia',
          original: { project: selectedItem.file_project },
          corrected: { project: newProject },
          reason: `User reassignment via review queue. Original: ${selectedItem.file_project}, Corrected: ${newProject}`,
          sourceId: selectedItem.thread_id,
          severity: selectedItem.metadata?.confidence && selectedItem.metadata.confidence < 60 ? 'major' : 'minor',
          confidenceBefore: selectedItem.metadata?.confidence
        });
      } else if (action === 'delete') {
        await logRejection({
          type: 'project_assignment',
          agentName: 'Sophia',
          rejected: {
            project: selectedItem.file_project,
            suggestedProject: selectedItem.suggested_project,
            threadId: selectedItem.thread_id
          },
          reason: `User deleted knowledge entry via review queue. Issue: ${selectedItem.issue_type}`,
          sourceId: selectedItem.thread_id,
          severity: 'major'
        });
      }
    } catch (error) {
      console.error('Failed to log feedback:', error);
      // Continue anyway - don't block user action
    }
    
    // Execute the actual action
    reviewMutation.mutate({
      id: selectedItem.id,
      action,
      newProject: action === 'reassign' ? newProject : undefined
    });
  };
  
  const handleBulkAction = (action: string) => {
    if (selectedIds.length === 0) return;
    bulkMutation.mutate({ action, ids: selectedIds });
  };
  
  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };
  
  const toggleSelectAll = () => {
    if (selectedIds.length === data?.items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data?.items.map(i => i.id) || []);
    }
  };
  
  const getConfidenceBadge = (confidence: number | undefined) => {
    if (!confidence) return <Badge variant="outline">Unknown</Badge>;
    if (confidence >= 80) return <Badge className="bg-green-500">High ({confidence}%)</Badge>;
    if (confidence >= 60) return <Badge variant="secondary">Medium ({confidence}%)</Badge>;
    return <Badge variant="destructive">Low ({confidence}%)</Badge>;
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleAction('approve');
    } else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if (newProject && newProject !== selectedItem?.file_project) {
        handleAction('reassign');
      }
    } else if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleAction('delete');
    }
  };
  
  const totalPages = Math.ceil((data?.total || 0) / itemsPerPage);
  
  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Sort
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Confidence Level</label>
              <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low (&lt;60%)</SelectItem>
                  <SelectItem value="medium">Medium (60-79%)</SelectItem>
                  <SelectItem value="high">High (80%+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Issue Type</label>
              <Select value={issueTypeFilter} onValueChange={setIssueTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="misfiled">Misfiled</SelectItem>
                  <SelectItem value="ambiguous">Ambiguous</SelectItem>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Sort By</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confidence">Confidence (Low First)</SelectItem>
                  <SelectItem value="date">Date (Newest First)</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Project</label>
              <Input
                placeholder="e.g., 24-01"
                value={projectFilter === 'all' ? '' : projectFilter}
                onChange={(e) => setProjectFilter(e.target.value || 'all')}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card className="border-amber-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleBulkAction('approve')}
                  disabled={bulkMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve All
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleBulkAction('delete')}
                  disabled={bulkMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Items Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Review Queue ({data?.total || 0} items)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.length === data?.items.length && data?.items.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-muted-foreground">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : data?.items && data.items.length > 0 ? (
            <div className="space-y-2">
              {data.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleReview(item)}
                >
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={() => toggleSelection(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{item.file_project}</Badge>
                      {item.suggested_project && (
                        <>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="destructive">{item.suggested_project}</Badge>
                        </>
                      )}
                      {getConfidenceBadge(item.metadata?.confidence)}
                      <Badge variant="secondary">{item.issue_type}</Badge>
                    </div>
                    
                    <div className="font-medium text-sm mb-1">{item.subject || 'No subject'}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {item.preview || item.metadata?.narrative?.summary || 'No preview'}
                    </div>
                    
                    <div className="text-xs text-muted-foreground mt-2">
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReview(item)}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              ✅ No items to review!
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
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
      
      {/* Review Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent 
          className="max-w-3xl max-h-[90vh]" 
          onKeyDown={handleKeyDown}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Review Knowledge Entry
            </DialogTitle>
            <DialogDescription>
              Review and approve, reassign, or delete this knowledge extraction
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 pr-4">
                {/* Subject */}
                <div>
                  <div className="text-sm font-medium mb-1">Email Subject</div>
                  <div className="text-sm text-muted-foreground">{selectedItem.subject || 'No subject'}</div>
                </div>
                
                {/* Project Info */}
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Currently Filed In</div>
                    <Badge variant="secondary">{selectedItem.file_project}</Badge>
                  </div>
                  
                  {selectedItem.suggested_project && (
                    <div>
                      <div className="text-sm font-medium mb-1">AI Suggests</div>
                      <Badge variant="destructive">{selectedItem.suggested_project}</Badge>
                    </div>
                  )}
                  
                  <div>
                    <div className="text-sm font-medium mb-1">Confidence</div>
                    {getConfidenceBadge(selectedItem.metadata?.confidence)}
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium mb-1">Issue Type</div>
                    <Badge variant="outline">{selectedItem.issue_type}</Badge>
                  </div>
                </div>
                
                <Separator />
                
                {/* Summary */}
                <div>
                  <div className="text-sm font-medium mb-2">AI Summary</div>
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                    {selectedItem.metadata?.narrative?.summary || selectedItem.preview || 'No summary available'}
                  </div>
                </div>
                
                {/* Key Takeaways */}
                {selectedItem.metadata?.narrative?.key_takeaways && selectedItem.metadata.narrative.key_takeaways.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Key Takeaways</div>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      {selectedItem.metadata.narrative.key_takeaways.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Participants */}
                {selectedItem.metadata?.participants && selectedItem.metadata.participants.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Participants</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedItem.metadata.participants.join(', ')}
                    </div>
                  </div>
                )}
                
                {/* Metadata */}
                <div>
                  <div className="text-sm font-medium mb-2">Details</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Thread ID: {selectedItem.thread_id}</div>
                    <div>Date Processed: {new Date(selectedItem.created_at).toLocaleString()}</div>
                  </div>
                </div>
                
                <Separator />
                
                {/* Reassign Input */}
                <div>
                  <div className="text-sm font-medium mb-2">Reassign to Project</div>
                  <Input
                    placeholder="e.g., 24-01, 25-18"
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter a project number to reassign this knowledge entry
                  </p>
                  
                  <Alert className="mt-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Note on Reassignment</AlertTitle>
                    <AlertDescription>
                      Reassigning updates the project association in the database. 
                      The original knowledge file remains unchanged. 
                      Future queries will use the new project assignment.
                    </AlertDescription>
                  </Alert>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="default"
                    onClick={() => handleAction('approve')}
                    disabled={reviewMutation.isPending}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve (A)
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleAction('reassign')}
                    disabled={
                      reviewMutation.isPending || 
                      !newProject || 
                      newProject === selectedItem.file_project
                    }
                    className="flex-1"
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Reassign (R)
                  </Button>
                  
                  <Button
                    variant="destructive"
                    onClick={() => handleAction('delete')}
                    disabled={reviewMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Delete (D)
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground text-center">
                  Use keyboard shortcuts: A to approve, R to reassign, D to delete
                </p>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
