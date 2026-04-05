import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  
  // Check admin auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  const profile = profileData as { role: string } | null;
  
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    // Get all queue items (not just pending)
    const { data: allItems } = await supabase
      .from('knowledge_review_queue')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Get pending reviews count
    const { count: pendingCount } = await supabase
      .from('knowledge_review_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    const items: any[] = allItems || [];
    
    // Calculate stats
    const totalMemories = items.length;
    const pendingReviews = pendingCount || 0;
    
    // Projects covered
    const projects = new Set(items.map(i => i.file_project));
    const projectsCovered = projects.size;
    
    // Average confidence
    const confidenceScores = items
      .map(i => (i.metadata as any)?.confidence || 0)
      .filter(c => c > 0);
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;
    
    // By project
    const byProject: Record<string, number> = {};
    items.forEach(item => {
      byProject[item.file_project] = (byProject[item.file_project] || 0) + 1;
    });
    
    // Confidence distribution
    const confidenceDistribution = {
      high: items.filter(i => ((i.metadata as any)?.confidence || 0) >= 80).length,
      medium: items.filter(i => {
        const conf = (i.metadata as any)?.confidence || 0;
        return conf >= 60 && conf < 80;
      }).length,
      low: items.filter(i => ((i.metadata as any)?.confidence || 0) < 60).length
    };
    
    // Timeline (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const timelineMap: Record<string, number> = {};
    
    items.forEach(item => {
      const date = new Date(item.created_at);
      if (date >= thirtyDaysAgo) {
        const dateKey = date.toISOString().split('T')[0];
        timelineMap[dateKey] = (timelineMap[dateKey] || 0) + 1;
      }
    });
    
    const timeline = Object.entries(timelineMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Top contributors (from metadata)
    const contributorMap: Record<string, number> = {};
    items.forEach(item => {
      const participants = (item.metadata as any)?.participants || [];
      participants.forEach((p: string) => {
        contributorMap[p] = (contributorMap[p] || 0) + 1;
      });
    });
    
    const topContributors = Object.entries(contributorMap)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Calculate storage and other stats from knowledge-v2 directory
    let totalEmails = 0;
    let totalThreads = 0;
    let storageUsed = '0 MB';
    let apiCost = 0;
    
    try {
      const knowledgeDir = path.join(process.cwd(), 'memory', 'knowledge-v2');
      const files = await fs.readdir(knowledgeDir);
      totalThreads = files.filter(f => f.endsWith('.json')).length;
      
      // Count total emails
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(knowledgeDir, file), 'utf-8');
          const data = JSON.parse(content);
          totalEmails += (data.sourceEmails || []).length;
        }
      }
      
      // Calculate directory size
      let totalSize = 0;
      for (const file of files) {
        const stats = await fs.stat(path.join(knowledgeDir, file));
        totalSize += stats.size;
      }
      storageUsed = `${(totalSize / 1024 / 1024).toFixed(2)} MB`;
      
    } catch (error) {
      console.error('Error calculating storage stats:', error);
    }
    
    // Get API costs for knowledge extraction (if tracked)
    const { data: costData } = await supabase
      .from('api_cost_log')
      .select('cost_usd')
      .eq('category', 'email-processing');
    
    if (costData) {
      apiCost = (costData as any[]).reduce((sum, item) => sum + parseFloat(item.cost_usd), 0);
    }
    
    // Recent activity (last 20)
    const recentActivity = items.slice(0, 20);
    
    return NextResponse.json({
      totalMemories,
      projectsCovered,
      pendingReviews,
      avgConfidence,
      byProject,
      confidenceDistribution,
      timeline,
      topContributors,
      totalEmails,
      totalThreads,
      storageUsed,
      apiCost,
      recentActivity
    });
    
  } catch (error) {
    console.error('Error fetching knowledge stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
