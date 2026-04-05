import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET single item with full metadata
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  
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
  
  const { data: item, error } = await supabase
    .from('knowledge_review_queue')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  return NextResponse.json(item);
}

// Actions: approve, reassign, delete
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  
  // Auth check
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
  const { action, newProject } = body;
  
  if (!action) {
    return NextResponse.json({ error: 'Action required' }, { status: 400 });
  }
  
  const updates: Record<string, unknown> = {
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString()
  };
  
  switch (action) {
    case 'approve':
      // Approve means the current assignment is correct
      updates.status = 'approved';
      // Get current file_project and set as final
      const { data: currentData } = await supabase
        .from('knowledge_review_queue')
        .select('file_project')
        .eq('id', id)
        .single();
      const current = currentData as { file_project: string } | null;
      updates.final_project = current?.file_project;
      break;
      
    case 'reassign':
      if (!newProject) {
        return NextResponse.json({ error: 'newProject required for reassign' }, { status: 400 });
      }
      updates.status = 'reassigned';
      updates.final_project = newProject;
      // Note: Actual file movement would require a separate process
      // This just tracks the decision in the database
      break;
      
    case 'delete':
      updates.status = 'deleted';
      break;
      
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  
  const { error } = await supabase
    .from('knowledge_review_queue')
    .update(updates as never)
    .eq('id', id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true, action, id });
}
