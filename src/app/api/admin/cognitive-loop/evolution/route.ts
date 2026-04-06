import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get learning rate trend
    const { data: learningRate, error: learningError } = await supabase
      .rpc('get_learning_rate');
    
    if (learningError) {
      console.error('Learning rate error:', learningError);
    }
    
    // Get total corrections by type
    const { data: corrections, error: correctionsError } = await supabase
      .from('evolution_log')
      .select('correction_type, corrected_at, impact_score');
    
    const correctionsByType = ((corrections || []) as any[]).reduce((acc: any, curr) => {
      acc[curr.correction_type] = (acc[curr.correction_type] || 0) + 1;
      return acc;
    }, {}) || {};
    
    // Get recent corrections (last 20)
    const { data: recentCorrections, error: recentError } = await supabase
      .from('evolution_log')
      .select('*')
      .order('corrected_at', { ascending: false })
      .limit(20);
    
    // Get reflection patterns
    const { data: reflections, error: reflectionsError } = await supabase
      .from('reflection_log')
      .select('reflection_type, severity, detected_at, resolved')
      .order('detected_at', { ascending: false })
      .limit(50);
    
    const reflectionSummary = {
      total: ((reflections || []) as any[]).length,
      unresolved: ((reflections || []) as any[]).filter(r => !r.resolved).length,
      by_type: {} as Record<string, number>,
      by_severity: {} as Record<string, number>
    };
    
    ((reflections || []) as any[]).forEach(r => {
      reflectionSummary.by_type[r.reflection_type] = (reflectionSummary.by_type[r.reflection_type] || 0) + 1;
      if (r.severity) {
        reflectionSummary.by_severity[r.severity] = (reflectionSummary.by_severity[r.severity] || 0) + 1;
      }
    });
    
    // Calculate average impact score
    const correctionsArray = ((corrections || []) as any[]);
    const avgImpact = correctionsArray.reduce((sum, c) => sum + (c.impact_score || 0), 0) / (correctionsArray.length || 1);
    
    // Calculate error reduction trend (last 12 weeks)
    const errorTrend = ((learningRate || []) as any[]).map(week => ({
      week: week.week_number,
      errors: week.error_count,
      corrections: week.correction_count,
      improvement_pct: week.improvement_pct
    })) || [];
    
    // Get pattern detection stats
    const { data: patterns, error: patternsError } = await supabase
      .from('reflection_log')
      .select('reflection_type')
      .eq('reflection_type', 'pattern_detected')
      .gte('detected_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    // Calculate corrections velocity (corrections per week)
    const weeklyCorrections = correctionsArray.reduce((acc: any[], curr) => {
      const week = new Date(curr.corrected_at).toISOString().split('T')[0];
      const existing = acc.find(item => item.week === week);
      
      if (existing) {
        existing.count++;
      } else {
        acc.push({ week, count: 1 });
      }
      
      return acc;
    }, []) || [];
    
    return NextResponse.json({
      summary: {
        total_corrections: corrections?.length || 0,
        corrections_by_type: correctionsByType,
        avg_impact_score: Math.round(avgImpact * 1000) / 1000,
        pattern_detections: patterns?.length || 0,
        unresolved_issues: reflectionSummary.unresolved
      },
      error_trend: errorTrend,
      recent_corrections: ((recentCorrections || []) as any[]).map(c => ({
        id: c.id,
        type: c.correction_type,
        description: c.description,
        impact_score: c.impact_score,
        corrected_at: c.corrected_at,
        corrected_by: c.corrected_by
      })) || [],
      reflection_summary: reflectionSummary,
      corrections_velocity: weeklyCorrections.slice(-12) // Last 12 weeks
    });
  } catch (error) {
    console.error('Evolution API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
