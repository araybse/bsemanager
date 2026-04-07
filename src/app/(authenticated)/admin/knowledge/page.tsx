'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KnowledgeDashboard } from '@/components/admin/knowledge/dashboard';
import { EntityGraphDashboard } from '@/components/admin/knowledge/entity-graph-dashboard';
import { KnowledgeReviewQueue } from '@/components/admin/knowledge/review-queue';
import { KnowledgeMemoryBrowser } from '@/components/admin/knowledge/memory-browser';
import { Brain } from 'lucide-react';

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  return (
    <div className="space-y-6 p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Processing Dashboard</TabsTrigger>
          <TabsTrigger value="graph">Entity Graph</TabsTrigger>
          <TabsTrigger value="review">Review Queue</TabsTrigger>
          <TabsTrigger value="browser">All Memories</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="mt-6">
          <KnowledgeDashboard />
        </TabsContent>
        
        <TabsContent value="graph" className="mt-6">
          <EntityGraphDashboard />
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
