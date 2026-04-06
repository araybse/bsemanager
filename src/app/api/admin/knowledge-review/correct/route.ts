import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/knowledge-review/correct
 * 
 * Submit a human correction to a memory extraction
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
    const {
      memory_id,
      thread_id,
      correction_type,
      before_value,
      after_value,
      reason,
      field_path,
      source_email_from,
      source_email_subject,
      source_project,
    } = body;

    // Validate required fields
    if (!memory_id || !correction_type || !before_value || !after_value) {
      return NextResponse.json(
        { error: 'Missing required fields: memory_id, correction_type, before_value, after_value' },
        { status: 400 }
      );
    }

    // Validate correction type
    const validTypes = [
      'entity_added', 'entity_removed', 'entity_fixed',
      'relationship_added', 'relationship_removed', 'relationship_fixed',
      'action_added', 'action_removed', 'action_fixed',
      'project_reassigned', 'narrative_fixed',
      'confidence_override', 'quality_override'
    ];

    if (!validTypes.includes(correction_type)) {
      return NextResponse.json(
        { error: `Invalid correction_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Get current version
    const { data: existingCorrections } = await supabase
      .from('memory_corrections')
      .select('memory_version')
      .eq('memory_id', memory_id)
      .order('memory_version', { ascending: false })
      .limit(1);

    const newVersion = (existingCorrections?.[0]?.memory_version || 0) + 1;

    // Insert correction
    const { data: correction, error: insertError } = await supabase
      .from('memory_corrections')
      .insert({
        memory_id,
        memory_version: newVersion,
        thread_id,
        correction_type,
        before_value,
        after_value,
        corrected_by: user.email || user.id,
        correction_reason: reason,
        field_path,
        source_email_from,
        source_email_subject,
        source_project,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting correction:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Also log to evolution_log for dashboard visibility
    await supabase.from('evolution_log').insert({
      correction_type: 'human_feedback',
      description: reason || `Correction: ${correction_type}`,
      before_value,
      after_value,
      source_thread: thread_id,
      corrected_by: user.email || user.id,
      impact_score: 0.5, // Default, updated later based on learning success
    });

    // Try to generate learning from this correction
    const learning = await generateLearningFromCorrection({
      correction_id: correction.id,
      correction_type,
      before_value,
      after_value,
      reason,
      source_email_from,
      source_project,
    }, supabase);

    return NextResponse.json({
      success: true,
      correction_id: correction.id,
      version: newVersion,
      learning_generated: learning,
    });
  } catch (error) {
    console.error('Correct API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate learning from a correction
 */
async function generateLearningFromCorrection(
  correction: {
    correction_id: number;
    correction_type: string;
    before_value: any;
    after_value: any;
    reason?: string;
    source_email_from?: string;
    source_project?: string;
  },
  supabase: any
) {
  const { correction_type, before_value, after_value, reason, source_email_from, source_project } = correction;

  let pattern: string | null = null;
  let patternType: string | null = null;
  let appliesTo: string | null = null;
  let ruleCondition: any = null;
  let ruleAction: any = null;

  // Analyze correction to identify patterns
  switch (correction_type) {
    case 'entity_added':
      if (after_value?.type && after_value?.name) {
        // Learn to extract this type of entity
        pattern = `Always extract "${after_value.name}" as ${after_value.type}`;
        patternType = 'entity_rule';
        appliesTo = 'entity_extraction';
        ruleCondition = { entity_name: after_value.name };
        ruleAction = { entity_type: after_value.type, confidence_boost: 0.1 };
        
        // If from specific sender, create sender pattern
        if (source_email_from) {
          pattern = `Emails from ${source_email_from.split('@')[1] || source_email_from} often involve ${after_value.type}: ${after_value.name}`;
          patternType = 'sender_pattern';
          ruleCondition = { sender_domain: source_email_from.split('@')[1] };
        }
      }
      break;

    case 'entity_removed':
      if (before_value?.type && before_value?.name) {
        // Learn to NOT extract this
        pattern = `Do not extract "${before_value.name}" as ${before_value.type} - commonly misidentified`;
        patternType = 'negative_pattern';
        appliesTo = 'entity_extraction';
        ruleCondition = { entity_name: before_value.name };
        ruleAction = { skip: true };
      }
      break;

    case 'project_reassigned':
      if (after_value?.project && source_email_from) {
        pattern = `Emails from ${source_email_from} typically belong to project ${after_value.project}`;
        patternType = 'project_pattern';
        appliesTo = 'project_assignment';
        ruleCondition = { sender_email: source_email_from };
        ruleAction = { suggested_project: after_value.project };
      }
      break;

    case 'action_added':
      if (after_value?.description) {
        // Identify keywords that indicate actions
        const keywords = after_value.description.match(/\b(need|must|should|will|deadline|due|submit|review|approve)\b/gi);
        if (keywords?.length) {
          pattern = `Keywords "${keywords.slice(0, 3).join(', ')}" indicate action items`;
          patternType = 'keyword_pattern';
          appliesTo = 'action_capture';
          ruleCondition = { keywords: keywords.slice(0, 3) };
          ruleAction = { flag_action_item: true, confidence_boost: 0.1 };
        }
      }
      break;
  }

  // If we identified a pattern, check if similar exists
  if (pattern && patternType && appliesTo) {
    // Check for existing similar learning
    const { data: existingLearnings } = await supabase
      .from('evolution_learnings')
      .select('*')
      .eq('pattern_type', patternType)
      .eq('applies_to', appliesTo)
      .textSearch('pattern', pattern.split(' ').slice(0, 3).join(' & '));

    if (existingLearnings?.length > 0) {
      // Validate existing learning
      const existing = existingLearnings[0];
      await supabase
        .from('evolution_learnings')
        .update({
          times_validated: existing.times_validated + 1,
          last_validated_at: new Date().toISOString(),
          learned_from: [...(existing.learned_from || []), correction.correction_id],
          // Auto-enable if validated enough
          auto_apply: existing.times_validated >= 4,
        })
        .eq('id', existing.id);

      // Update the correction with generated learning
      await supabase
        .from('memory_corrections')
        .update({ learning_generated: { existing_learning_id: existing.id, validated: true } })
        .eq('id', correction.correction_id);

      return { type: 'validated_existing', learning_id: existing.id };
    } else {
      // Create new learning
      const { data: newLearning, error } = await supabase
        .from('evolution_learnings')
        .insert({
          pattern,
          pattern_type: patternType,
          applies_to: appliesTo,
          rule_condition: ruleCondition,
          rule_action: ruleAction,
          confidence_boost: 0.1,
          learned_from: [correction.correction_id],
          active: true,
          auto_apply: false, // Starts inactive, needs validation
        })
        .select()
        .single();

      if (!error && newLearning) {
        // Update the correction with generated learning
        await supabase
          .from('memory_corrections')
          .update({ learning_generated: { new_learning_id: newLearning.id, pattern } })
          .eq('id', correction.correction_id);

        return { type: 'created_new', learning_id: newLearning.id, pattern };
      }
    }
  }

  return null;
}
