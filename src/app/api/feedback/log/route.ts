import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/feedback/log
 * 
 * Log agent feedback (corrections, approvals, rejections, escalations)
 * for self-improvement and training purposes.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const {
      feedbackType,
      agentName,
      type,
      original,
      corrected,
      output,
      rejected,
      reason,
      sourceId,
      severity,
      userComment,
      confidenceBefore,
      confidenceWas,
      taskType,
      metadata
    } = body;
    
    // Validate required fields
    if (!feedbackType) {
      return NextResponse.json(
        { error: 'feedbackType is required' },
        { status: 400 }
      );
    }
    
    // Build the insert payload
    const insertData: any = {
      feedback_type: feedbackType,
      agent_name: agentName || null,
      task_type: type || taskType || null,
      source_id: sourceId || null,
      correction_reason: reason || null,
      user_comment: userComment || null,
      severity: severity || null,
      confidence_before: confidenceBefore || confidenceWas || null,
      metadata: metadata || {}
    };
    
    // Handle different feedback types
    switch (feedbackType) {
      case 'correction':
        insertData.original_output = original || null;
        insertData.corrected_output = corrected || null;
        break;
        
      case 'approval':
        insertData.corrected_output = output || null;
        insertData.severity = 'cosmetic'; // Approval = no issue
        break;
        
      case 'rejection':
        insertData.original_output = rejected || null;
        break;
        
      case 'escalation':
        insertData.original_output = metadata || null;
        break;
    }
    
    // Insert into agent_feedback table
    const { data, error } = await supabase
      .from('agent_feedback')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to log feedback', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      feedback: data
    });
    
  } catch (error) {
    console.error('Error in /api/feedback/log:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feedback/log
 * 
 * Retrieve feedback logs (for admin review)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const agentName = searchParams.get('agent');
    const feedbackType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = supabase
      .from('agent_feedback')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (agentName) {
      query = query.eq('agent_name', agentName);
    }
    
    if (feedbackType) {
      query = query.eq('feedback_type', feedbackType);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feedback', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      total: count || 0,
      feedback: data || []
    });
    
  } catch (error) {
    console.error('Error in /api/feedback/log GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
