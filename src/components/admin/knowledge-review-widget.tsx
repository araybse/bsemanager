'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, CheckCircle, XCircle, AlertTriangle, ArrowRight, RefreshCw, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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
    narrative?: {
      summary?: string;
      key_takeaways?: string[];
    };
    sourceEmails?: Array<{
      subject?: string;
      from?: string;
      date?: string;
    }>;
  };
  created_at: string;
}

interface ReviewQueueResponse {
  total: number;
  misfiled: ReviewItem[];
  ambiguous: ReviewItem[];
  needsReview: ReviewItem[];
  items: ReviewItem[];
}

export function KnowledgeReviewWidget() {
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [newProject, setNewProject] = useState('');
  const [queueIndex, setQueueIndex] = useState(0);
  
  const queryClient = useQueryClient();
  
  const { data, isLoading, refetch } = useQuery<ReviewQueueResponse>({
    queryKey: ['knowledge-review-queue'],
    queryFn: () => fetch('/api/knowledge/review-queue').then(r => {
      if (!r.ok) throw new Error('Failed to fetch');
      return r.json();
    }),
    refetchInterval: 60000, // 1 minute
    retry: false
  });
  
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
      // Move to next item
      if (data?.items && queueIndex < data.items.length - 1) {
        const nextItem = data.items[queueIndex + 1];
        setSelectedItem(nextItem);
        setNewProject(nextItem.suggested_project || '');
        setQueueIndex(queueIndex + 1);
      } else {
        setReviewModalOpen(false);
        setSelectedItem(null);
        setNewProject('');
        setQueueIndex(0);
      }
    }
  });
  
  const handleReview = (item: ReviewItem, index: number = 0) => {
    setSelectedItem(item);
    setNewProject(item.suggested_project || '');
    setQueueIndex(index);
    setReviewModalOpen(true);
  };
  
  const handleAction = (action: 'approve' | 'reassign' | 'delete') => {
    if (!selectedItem) return;
    
    reviewMutation.mutate({
      id: selectedItem.id,
      action,
      newProject: action === 'reassign' ? newProject : undefined
    });
  };
  
  // Handle keyboard shortcuts in modal
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
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Knowledge Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }
  
  const total = data?.total || 0;
  const misfiledCount = data?.misfiled?.length || 0;
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Knowledge Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {total === 0 ? (
              <div className="text-sm text-muted-foreground">
                ✅ All knowledge entries reviewed!
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">{total} items</div>
                
                <div className="space-y-2">
                  {misfiledCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400">
                        {misfiledCount} potentially misfiled
                      </span>
                    </div>
                  )}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (data?.items?.[0]) {
                      handleReview(data.items[0], 0);
                    }
                  }}
                >
                  Start Review <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
            
            <Button 
              variant="ghost" 
              size="sm"
              className="w-full text-xs"
              onClick={() => refetch()}
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Refresh
            </Button>
          </div>
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
              <Badge variant="outline" className="ml-2">
                {queueIndex + 1} / {data?.total || 0}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Review and approve, reassign, or delete this knowledge extraction
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              {/* Email Subject */}
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
                  <div className="text-sm font-medium mb-1">Issue Type</div>
                  <Badge variant="outline">{selectedItem.issue_type}</Badge>
                </div>
              </div>
              
              <Separator />
              
              {/* Summary */}
              <div>
                <div className="text-sm font-medium mb-2">AI Summary</div>
                <ScrollArea className="h-[200px]">
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded whitespace-pre-wrap">
                    {selectedItem.metadata?.narrative?.summary || selectedItem.preview || 'No summary available'}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Key Takeaways */}
              {selectedItem.metadata?.narrative?.key_takeaways && selectedItem.metadata.narrative.key_takeaways.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Key Takeaways</div>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    {selectedItem.metadata.narrative.key_takeaways.slice(0, 3).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
