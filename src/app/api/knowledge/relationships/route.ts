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
  
  const entityId = searchParams.get('entityId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  
  try {
    let query = (supabase as any)
      .from('canonical_relationships')
      .select(`
        *,
        from_entity:canonical_entities!from_entity_id(id, canonical_name, entity_type),
        to_entity:canonical_entities!to_entity_id(id, canonical_name, entity_type)
      `, { count: 'exact' });
    
    if (entityId) {
      query = query.or(`from_entity_id.eq.${entityId},to_entity_id.eq.${entityId}`);
    }
    
    const { data, count, error } = await query
      .order('current_strength', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data, count, page, limit });
  } catch (error) {
    console.error('Error fetching relationships:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
