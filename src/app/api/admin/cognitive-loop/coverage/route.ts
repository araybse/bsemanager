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
    
    // Get coverage metrics
    const { data: coverage, error: coverageError } = await supabase
      .rpc('get_processing_coverage');
    
    if (coverageError) {
      console.error('Coverage metrics error:', coverageError);
      return NextResponse.json({ error: 'Failed to fetch coverage metrics' }, { status: 500 });
    }
    
    // Get processing gaps
    const { data: gaps, error: gapsError } = await supabase
      .from('processing_coverage_gaps')
      .select('*')
      .order('gap_start', { ascending: false })
      .limit(10);
    
    // Get daily processing volume (last 30 days)
    const { data: processedByDay, error: volumeError } = await supabase
      .from('email_processing_log')
      .select('processed_at, status')
      .gte('processed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('processed_at', { ascending: true });
    
    // Group by day
    const dailyVolume = processedByDay?.reduce((acc: any[], curr) => {
      const date = new Date(curr.processed_at).toISOString().split('T')[0];
      const existing = acc.find(item => item.date === date);
      
      if (existing) {
        existing.total++;
        if (curr.status === 'processed') existing.successful++;
        if (curr.status === 'failed') existing.failed++;
      } else {
        acc.push({
          date,
          total: 1,
          successful: curr.status === 'processed' ? 1 : 0,
          failed: curr.status === 'failed' ? 1 : 0
        });
      }
      
      return acc;
    }, []);
    
    // Get current backlog breakdown by status
    const { data: backlogBreakdown, error: backlogError } = await supabase
      .from('email_processing_log')
      .select('status')
      .in('status', ['pending', 'failed', 'needs_review']);
    
    const backlogCounts = {
      pending: 0,
      failed: 0,
      needs_review: 0
    };
    
    backlogBreakdown?.forEach(item => {
      if (item.status === 'pending') backlogCounts.pending++;
      if (item.status === 'failed') backlogCounts.failed++;
      if (item.status === 'needs_review') backlogCounts.needs_review++;
    });
    
    // Calculate processing rate (emails/hour) over last 24h
    const { data: last24h, error: rateError } = await supabase
      .from('email_processing_log')
      .select('processed_at')
      .eq('status', 'processed')
      .gte('processed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    const processingRate = last24h ? (last24h.length / 24).toFixed(1) : '0';
    
    const coverageData = coverage?.[0] || {
      total_processed: 0,
      backlog_size: 0,
      success_rate: 0,
      gaps_count: 0,
      oldest_unprocessed: null
    };
    
    return NextResponse.json({
      summary: {
        total_processed: coverageData.total_processed,
        backlog_size: coverageData.backlog_size,
        success_rate: Math.round(coverageData.success_rate * 10) / 10,
        processing_rate: parseFloat(processingRate),
        gaps_count: coverageData.gaps_count,
        oldest_unprocessed: coverageData.oldest_unprocessed
      },
      backlog_breakdown: backlogCounts,
      daily_volume: dailyVolume || [],
      gaps: gaps || []
    });
  } catch (error) {
    console.error('Coverage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
