import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/knowledge-review/patterns
 * 
 * Returns aggregated correction patterns
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get correction statistics
    const { data: stats, error: statsError } = await supabase.rpc('get_correction_stats');

    // Get recent corrections grouped by type
    const { data: corrections, error: correctionsError } = await supabase
      .from('memory_corrections')
      .select('correction_type, correction_reason, source_project, source_email_from, corrected_at')
      .order('corrected_at', { ascending: false })
      .limit(500);

    if (correctionsError) {
      console.error('Error fetching corrections:', correctionsError);
    }

    // Aggregate patterns from corrections
    const patterns: Record<string, {
      count: number;
      examples: string[];
      projects: Set<string>;
      senders: Set<string>;
      lastSeen: string;
    }> = {};

    corrections?.forEach(c => {
      const key = `${c.correction_type}:${c.correction_reason?.slice(0, 50) || 'no reason'}`;
      
      if (!patterns[key]) {
        patterns[key] = {
          count: 0,
          examples: [],
          projects: new Set(),
          senders: new Set(),
          lastSeen: c.corrected_at,
        };
      }
      
      patterns[key].count++;
      
      if (c.correction_reason && patterns[key].examples.length < 3) {
        patterns[key].examples.push(c.correction_reason);
      }
      if (c.source_project) patterns[key].projects.add(c.source_project);
      if (c.source_email_from) patterns[key].senders.add(c.source_email_from);
      if (c.corrected_at > patterns[key].lastSeen) {
        patterns[key].lastSeen = c.corrected_at;
      }
    });

    // Convert to array and sort by count
    const patternList = Object.entries(patterns)
      .map(([key, data]) => {
        const [type, reason] = key.split(':');
        return {
          correction_type: type,
          pattern_summary: reason,
          occurrence_count: data.count,
          examples: data.examples,
          affected_projects: Array.from(data.projects),
          affected_senders: Array.from(data.senders),
          last_seen: data.lastSeen,
          requires_attention: data.count >= 5, // Flag if same issue happens 5+ times
        };
      })
      .sort((a, b) => b.occurrence_count - a.occurrence_count)
      .slice(0, 50);

    // Get pattern aggregation from database if available
    const { data: storedPatterns } = await supabase
      .from('pattern_aggregation')
      .select('*')
      .order('occurrence_count', { ascending: false })
      .limit(20);

    return NextResponse.json({
      stats: stats?.[0] || null,
      patterns: patternList,
      stored_patterns: storedPatterns || [],
      correction_types: [...new Set(corrections?.map(c => c.correction_type) || [])],
    });
  } catch (error) {
    console.error('Patterns API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
