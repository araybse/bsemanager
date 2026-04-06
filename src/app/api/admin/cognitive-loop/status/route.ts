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
    
    // Get current health status
    const { data: health, error: healthError } = await supabase
      .rpc('get_cognitive_loop_health');
    
    if (healthError) {
      console.error('Health check error:', healthError);
      return NextResponse.json({ error: 'Failed to fetch health status' }, { status: 500 });
    }
    
    // Get last 24h error details
    const { data: recentErrors, error: errorsError } = await supabase
      .from('cognitive_loop_health')
      .select('heartbeat_at, status, last_error, error_count')
      .eq('status', 'error')
      .gte('heartbeat_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('heartbeat_at', { ascending: false })
      .limit(10);
    
    // Get processing rate trend (last 12 hours)
    const { data: rateTrend, error: trendError } = await supabase
      .from('cognitive_loop_health')
      .select('heartbeat_at, processing_rate')
      .gte('heartbeat_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .order('heartbeat_at', { ascending: true });
    
    const currentHealth = health?.[0] || {
      status: 'unknown',
      uptime_hours: 0,
      last_heartbeat: null,
      error_count: 0,
      processing_rate: 0,
      health_score: 0
    };
    
    // Calculate status indicator
    const now = new Date();
    const lastHeartbeat = currentHealth.last_heartbeat ? new Date(currentHealth.last_heartbeat) : null;
    const minutesSinceHeartbeat = lastHeartbeat 
      ? (now.getTime() - lastHeartbeat.getTime()) / (1000 * 60) 
      : 999;
    
    let statusIndicator = '🔴'; // Red - stopped
    if (currentHealth.status === 'running' && minutesSinceHeartbeat < 10) {
      statusIndicator = '🟢'; // Green - healthy
    } else if (currentHealth.status === 'degraded' || minutesSinceHeartbeat < 30) {
      statusIndicator = '🟡'; // Yellow - degraded
    }
    
    return NextResponse.json({
      status: currentHealth.status,
      indicator: statusIndicator,
      uptime_hours: Math.round(currentHealth.uptime_hours * 10) / 10,
      last_heartbeat: currentHealth.last_heartbeat,
      minutes_since_heartbeat: Math.round(minutesSinceHeartbeat),
      error_count_24h: currentHealth.error_count,
      processing_rate: Math.round(currentHealth.processing_rate * 10) / 10,
      health_score: Math.round(currentHealth.health_score),
      recent_errors: recentErrors || [],
      rate_trend: rateTrend || []
    });
  } catch (error) {
    console.error('System health API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
