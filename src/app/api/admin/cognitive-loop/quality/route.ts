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
    
    // Get quality metrics summary
    const { data: qualityMetrics, error: metricsError } = await supabase
      .rpc('get_quality_metrics');
    
    if (metricsError) {
      console.error('Quality metrics error:', metricsError);
      return NextResponse.json({ error: 'Failed to fetch quality metrics' }, { status: 500 });
    }
    
    // Get quality trend over last 30 days
    const { data: qualityTrend, error: trendError } = await supabase
      .from('extraction_quality_log')
      .select('extracted_at, overall_score, entity_score, relationship_score, action_score, narrative_score')
      .gte('extracted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('extracted_at', { ascending: true });
    
    // Group by day and calculate daily averages
    const qualityTrendArray = ((qualityTrend || []) as any[]);
    const dailyAverages = qualityTrendArray.reduce((acc: any[], curr) => {
      const date = new Date(curr.extracted_at).toISOString().split('T')[0];
      const existing = acc.find(item => item.date === date);
      
      if (existing) {
        existing.count++;
        existing.overall_total += curr.overall_score;
        existing.entity_total += curr.entity_score || 0;
        existing.relationship_total += curr.relationship_score || 0;
        existing.action_total += curr.action_score || 0;
        existing.narrative_total += curr.narrative_score || 0;
      } else {
        acc.push({
          date,
          count: 1,
          overall_total: curr.overall_score,
          entity_total: curr.entity_score || 0,
          relationship_total: curr.relationship_score || 0,
          action_total: curr.action_score || 0,
          narrative_total: curr.narrative_score || 0
        });
      }
      
      return acc;
    }, []).map(day => ({
      date: day.date,
      overall: Math.round((day.overall_total / day.count) * 100) / 100,
      entity: Math.round((day.entity_total / day.count) * 100) / 100,
      relationship: Math.round((day.relationship_total / day.count) * 100) / 100,
      action: Math.round((day.action_total / day.count) * 100) / 100,
      narrative: Math.round((day.narrative_total / day.count) * 100) / 100
    }));
    
    // Get items needing review
    const { data: reviewItems, error: reviewError } = await supabase
      .from('extraction_quality_log')
      .select('id, thread_id, overall_score, needs_review, review_reason, extracted_at')
      .eq('needs_review', true)
      .order('extracted_at', { ascending: false })
      .limit(20);
    
    // Calculate quality distribution
    const { data: allScores, error: scoresError } = await supabase
      .from('extraction_quality_log')
      .select('overall_score')
      .gte('extracted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    const distribution = {
      excellent: 0,  // 9.0-10.0
      high: 0,       // 8.0-8.9
      medium: 0,     // 6.0-7.9
      low: 0         // < 6.0
    };
    
    ((allScores || []) as any[]).forEach(item => {
      const score = item.overall_score;
      if (score >= 9.0) distribution.excellent++;
      else if (score >= 8.0) distribution.high++;
      else if (score >= 6.0) distribution.medium++;
      else distribution.low++;
    });
    
    const metrics = ((qualityMetrics || []) as any[])[0] || {
      avg_overall: 0,
      avg_entity: 0,
      avg_relationship: 0,
      avg_action: 0,
      avg_narrative: 0,
      high_quality_pct: 0,
      needs_review_count: 0
    };
    
    return NextResponse.json({
      summary: {
        avg_overall: Math.round(metrics.avg_overall * 100) / 100,
        avg_entity: Math.round(metrics.avg_entity * 100) / 100,
        avg_relationship: Math.round(metrics.avg_relationship * 100) / 100,
        avg_action: Math.round(metrics.avg_action * 100) / 100,
        avg_narrative: Math.round(metrics.avg_narrative * 100) / 100,
        high_quality_pct: Math.round(metrics.high_quality_pct * 10) / 10,
        needs_review_count: metrics.needs_review_count
      },
      trend: dailyAverages || [],
      distribution,
      review_queue: reviewItems || []
    });
  } catch (error) {
    console.error('Quality metrics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
