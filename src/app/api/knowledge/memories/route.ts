import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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
  
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const project = searchParams.get('project') || 'all';
  const status = searchParams.get('status') || 'all';
  const confidenceMin = parseInt(searchParams.get('confidence_min') || '0');
  const confidenceMax = parseInt(searchParams.get('confidence_max') || '100');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  
  try {
    let query = supabase
      .from('knowledge_review_queue')
      .select('*', { count: 'exact' });
    
    // Apply filters
    if (project !== 'all') {
      query = query.eq('file_project', project);
    }
    
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    // Full-text search (subject, preview)
    if (search) {
      query = query.or(`subject.ilike.%${search}%,preview.ilike.%${search}%`);
    }
    
    // Get all matching items first for confidence filtering
    const { data: allItems, count: totalCount } = await query;
    
    // Filter by confidence (client-side since it's in JSONB)
    let filtered: any[] = allItems || [];
    if (confidenceMin > 0 || confidenceMax < 100) {
      filtered = filtered.filter(item => {
        const confidence = (item.metadata as any)?.confidence || 0;
        return confidence >= confidenceMin && confidence <= confidenceMax;
      });
    }
    
    // Search in metadata participants (client-side)
    if (search) {
      filtered = filtered.filter(item => {
        const participants = (item.metadata as any)?.participants || [];
        const summary = (item.metadata as any)?.narrative?.summary || '';
        return (
          item.subject?.toLowerCase().includes(search.toLowerCase()) ||
          item.preview?.toLowerCase().includes(search.toLowerCase()) ||
          participants.some((p: string) => p.toLowerCase().includes(search.toLowerCase())) ||
          summary.toLowerCase().includes(search.toLowerCase())
        );
      });
    }
    
    const filteredCount = filtered.length;
    
    // Pagination
    const offset = (page - 1) * limit;
    const memories = filtered
      .slice(offset, offset + limit)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return NextResponse.json({
      memories,
      total: totalCount || 0,
      filtered: filteredCount
    });
    
  } catch (error) {
    console.error('Error fetching memories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
