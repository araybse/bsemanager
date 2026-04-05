import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') || '30');
  
  // Verify user is authenticated and is admin
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null };
  
  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Use admin client to bypass RLS
  const supabase = createAdminClient();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { data: costs } = await supabase
    .from('api_cost_log')
    .select('cost_usd, timestamp')
    .gte('timestamp', startDate.toISOString())
    .order('timestamp') as { data: Array<{ cost_usd: string; timestamp: string }> | null };
  
  // Group by day
  const dailyCosts = costs?.reduce((acc, c) => {
    const date = new Date(c.timestamp).toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + parseFloat(c.cost_usd);
    return acc;
  }, {} as Record<string, number>);
  
  const trend = Object.entries(dailyCosts || {}).map(([date, cost]) => ({
    date,
    cost
  }));
  
  return Response.json({ trend });
}
