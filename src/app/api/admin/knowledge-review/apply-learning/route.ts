import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/knowledge-review/apply-learning
 * 
 * Apply a learning to pending memories (re-process with learned patterns)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { learning_id, memory_ids } = body;

    if (!learning_id) {
      return NextResponse.json({ error: 'Missing learning_id' }, { status: 400 });
    }

    // Get the learning
    const { data: learning, error: learningError } = await supabase
      .from('evolution_learnings')
      .select('*')
      .eq('id', learning_id)
      .single();

    if (learningError || !learning) {
      return NextResponse.json({ error: 'Learning not found' }, { status: 404 });
    }

    const learningData = learning as any;
    if (!learningData?.active) {
      return NextResponse.json({ error: 'Learning is not active' }, { status: 400 });
    }

    // If specific memory_ids provided, apply to those
    // Otherwise, find pending items that match the learning's conditions
    let targetMemories: string[] = memory_ids || [];

    if (!memory_ids?.length) {
      // Find memories in the review queue that might benefit from this learning
      const { data: pendingItems } = await supabase
        .from('cognitive_review_queue')
        .select('memory_id, thread_id, original_extraction')
        .eq('status', 'pending')
        .limit(100);

      // Filter based on learning conditions
      if (learningData.rule_condition && pendingItems) {
        targetMemories = (pendingItems as any[] || [])
          .filter(item => matchesLearningCondition(item, learningData))
          .map(item => item.memory_id);
      }
    }

    // Log application attempts
    const applications = [];
    
    for (const memoryId of targetMemories.slice(0, 50)) { // Limit to 50 at a time
      const { data: application, error: appError } = await supabase
        .from('learning_application_log')
        .insert({
          learning_id: learningData.id,
          memory_id: memoryId,
          confidence_change: learningData.confidence_boost,
          applied_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (!appError) {
        applications.push(application);
      }
    }

    // Update learning stats
    await (supabase
      .from('evolution_learnings') as any)
      .update({
        times_validated: (learningData.times_validated || 0) + applications.length,
        last_validated_at: new Date().toISOString(),
      })
      .eq('id', learningData.id);

    return NextResponse.json({
      success: true,
      learning_id: learningData.id,
      applied_to: applications.length,
      target_memories: targetMemories.length,
    });
  } catch (error) {
    console.error('Apply learning API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Check if a memory matches a learning's conditions
 */
function matchesLearningCondition(item: any, learning: any): boolean {
  const condition = learning.rule_condition;
  if (!condition) return false;

  const extraction = item.original_extraction || {};
  
  // Check sender domain
  if (condition.sender_domain) {
    const from = extraction.source?.participants?.[0] || '';
    if (!from.includes(condition.sender_domain)) return false;
  }

  // Check sender email
  if (condition.sender_email) {
    const from = extraction.source?.participants?.[0] || '';
    if (from !== condition.sender_email) return false;
  }

  // Check entity name
  if (condition.entity_name) {
    const entities = extraction.layers?.understanding?.entities || [];
    const hasEntity = entities.some((e: any) => 
      e.name?.toLowerCase().includes(condition.entity_name.toLowerCase())
    );
    if (!hasEntity && learning.pattern_type !== 'negative_pattern') return false;
  }

  // Check keywords
  if (condition.keywords) {
    const text = extraction.for_vector || extraction.layers?.understanding?.narrative?.summary || '';
    const hasKeywords = condition.keywords.some((kw: string) => 
      text.toLowerCase().includes(kw.toLowerCase())
    );
    if (!hasKeywords) return false;
  }

  return true;
}

/**
 * GET /api/admin/knowledge-review/apply-learning
 * 
 * Get application history for learnings
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
    const learningId = searchParams.get('learning_id');

    let query = supabase
      .from('learning_application_log')
      .select('*, evolution_learnings(pattern, pattern_type)')
      .order('applied_at', { ascending: false })
      .limit(100);

    if (learningId) {
      query = query.eq('learning_id', parseInt(learningId));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching application log:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get validation stats
    const validated = (data as any[] || []).filter(d => d.validated === true).length || 0;
    const invalidated = (data as any[] || []).filter(d => d.validated === false).length || 0;
    const pending = (data as any[] || []).filter(d => d.validated === null).length || 0;

    return NextResponse.json({
      applications: data || [],
      stats: {
        total: data?.length || 0,
        validated,
        invalidated,
        pending,
        success_rate: validated + invalidated > 0 
          ? (validated / (validated + invalidated) * 100).toFixed(1)
          : null,
      },
    });
  } catch (error) {
    console.error('Application log API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
