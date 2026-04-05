'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KnowledgeDashboard } from '@/components/admin/knowledge/dashboard';
import { KnowledgeReviewQueue } from '@/components/admin/knowledge/review-queue';
import { KnowledgeMemoryBrowser } from '@/components/admin/knowledge/memory-browser';
import { Brain } from 'lucide-react';

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Brain className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Knowledge Management</h1>
          <p className="text-muted-foreground">
            AI-extracted project knowledge from emails and transcripts
          </p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="review">Review Queue</TabsTrigger>
          <TabsTrigger value="browser">All Memories</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="mt-6">
          <KnowledgeDashboard />
        </TabsContent>
        
        <TabsContent value="review" className="mt-6">
          <KnowledgeReviewQueue />
        </TabsContent>
        
        <TabsContent value="browser" className="mt-6">
          <KnowledgeMemoryBrowser />
        </TabsContent>
      </Tabs>
    </div>
  );
}
