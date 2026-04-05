import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Type for knowledge review queue items (defined here until schema is regenerated)
interface KnowledgeReviewQueueItem {
  id: number;
  thread_id: string;
  file_project: string;
  suggested_project: string | null;
  subject: string | null;
  preview: string | null;
  processed_date: string | null;
  status: string;
  issue_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  final_project: string | null;
}

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
  
  // Get pending reviews
  const result = await supabase
    .from('knowledge_review_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);
  
  const items = result.data as KnowledgeReviewQueueItem[] | null;
  const error = result.error;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Group by issue type
  const misfiled = items?.filter(i => i.issue_type === 'misfiled') || [];
  const ambiguous = items?.filter(i => i.issue_type === 'ambiguous') || [];
  const needsReview = items?.filter(i => i.issue_type === 'needs_review') || [];
  
  return NextResponse.json({
    total: items?.length || 0,
    misfiled,
    ambiguous,
    needsReview,
    items: items || []
  });
}

// Bulk actions endpoint
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  // Check admin auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { data: profileData2 } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  const profile2 = profileData2 as { role: string } | null;
  
  if (profile2?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const body = await request.json();
  const { action, ids } = body;
  
  if (!action || !ids || !Array.isArray(ids)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  
  const updates: Record<string, unknown> = {
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString()
  };
  
  switch (action) {
    case 'approve_all':
      updates.status = 'approved';
      break;
    case 'delete_all':
      updates.status = 'deleted';
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  
  const { error } = await supabase
    .from('knowledge_review_queue')
    .update(updates as never)
    .in('id', ids);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true, updated: ids.length });
}
