import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/knowledge-review/learnings
 * 
 * Returns list of generated learnings from corrections
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const appliesTo = searchParams.get('applies_to');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase
      .from('evolution_learnings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (activeOnly) {
      query = query.eq('active', true);
    }

    if (appliesTo) {
      query = query.eq('applies_to', appliesTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching learnings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      learnings: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    console.error('Learnings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/knowledge-review/learnings
 * 
 * Update a learning (toggle active, update confidence, etc.)
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, active, auto_apply, confidence_boost } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing learning id' }, { status: 400 });
    }

    const updates: any = {};
    if (typeof active === 'boolean') updates.active = active;
    if (typeof auto_apply === 'boolean') updates.auto_apply = auto_apply;
    if (typeof confidence_boost === 'number') updates.confidence_boost = confidence_boost;

    if (active === false) {
      updates.deactivated_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('evolution_learnings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating learning:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, learning: data });
  } catch (error) {
    console.error('Learnings PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
