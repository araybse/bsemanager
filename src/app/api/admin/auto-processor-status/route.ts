import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
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
  
  try {
    // 1. Check if auto-processor is running
    const { data: state, error: stateError } = await supabase
      .from('auto_processor_state')
      .select('*')
      .order('last_check', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const lastCheckTime = state ? new Date((state as any).last_check) : null;
    const minutesSinceLastCheck = lastCheckTime 
      ? (Date.now() - lastCheckTime.getTime()) / 1000 / 60 
      : null;
    
    // Determine health status
    let status: 'healthy' | 'warning' | 'error' | 'stopped' = 'stopped';
    if (minutesSinceLastCheck !== null) {
      if (minutesSinceLastCheck < 10) status = 'healthy';
      else if (minutesSinceLastCheck < 30) status = 'warning';
      else status = 'error';
    }
    
    // 2. Get email stats (last 24 hours) from email_processing_log
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { data: recentEmails } = await supabase
      .from('email_processing_log')
      .select('*')
      .gte('processed_at', oneDayAgo.toISOString());
    
    // Count sent vs received based on metadata
    const sentCount = recentEmails?.filter((e: any) => 
      e.from_address?.toLowerCase().includes('austin') ||
      e.from_address?.toLowerCase().includes('ray')
    ).length || 0;
    
    const receivedCount = (recentEmails?.length || 0) - sentCount;
    
    // 3. Get meeting transcript stats (Plaud)
    const { data: transcripts } = await supabase
      .from('email_processing_log')
      .select('*')
      .gte('processed_at', oneDayAgo.toISOString())
      .not('plaud_transcript_id', 'is', null);
    
    // 4. Calculate confidence scores
    const allRecent = recentEmails || [];
    const confidenceScores = allRecent
      .map((m: any) => parseFloat(m.confidence) || 0)
      .filter(c => c > 0);
    
    const avgConfidence = confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length * 100)
      : 0;
    
    const highCount = confidenceScores.filter(c => c >= 0.8).length;
    const mediumCount = confidenceScores.filter(c => c >= 0.5 && c < 0.8).length;
    const lowCount = confidenceScores.filter(c => c < 0.5).length;
    
    return NextResponse.json({
      status,
      lastProcessed: lastCheckTime?.toISOString(),
      minutesSinceLastCheck,
      stats: {
        emails: {
          total: recentEmails?.length || 0,
          sent: sentCount,
          received: receivedCount
        },
        transcripts: transcripts?.length || 0,
        confidence: {
          average: avgConfidence,
          high: highCount,
          medium: mediumCount,
          low: lowCount
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching auto-processor status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
