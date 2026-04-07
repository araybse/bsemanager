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
  
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const entityType = searchParams.get('type');
  const search = searchParams.get('search');
  const minConfidence = parseFloat(searchParams.get('minConfidence') || '0');
  
  try {
    let query = (supabase as any)
      .from('canonical_entities')
      .select('*', { count: 'exact' });
    
    if (entityType && entityType !== 'all') {
      query = query.eq('entity_type', entityType);
    }
    
    if (search) {
      query = query.ilike('canonical_name', `%${search}%`);
    }
    
    if (minConfidence > 0) {
      query = query.gte('confidence', minConfidence);
    }
    
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data, count, page, limit });
  } catch (error) {
    console.error('Error fetching entities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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
    const body = await request.json();
    const { id, updates } = body;
    
    const { data, error } = await (supabase as any)
      .from('canonical_entities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating entity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
