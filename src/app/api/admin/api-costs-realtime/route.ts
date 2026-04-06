import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';

interface CostRecord {
  id: number;
  session_key: string;
  session_type: string | null;
  agent_name: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  estimated_cost_usd: string;
  session_duration_ms: number | null;
  created_at: string;
  usage_date: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action') || 'query';
  const date = searchParams.get('date');
  
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
  
  // Handle different actions
  if (action === 'today' || !date) {
    return handleToday(supabase);
  } else if (action === 'summary') {
    return handleSummary(supabase);
  } else {
    return handleQuery(supabase, date);
  }
}

async function handleToday(supabase: any) {
  const today = new Date().toISOString().split('T')[0];
  return handleQuery(supabase, today);
}

async function handleQuery(supabase: any, date: string) {
  const { data: costs, error } = await supabase
    .from('api_costs_realtime')
    .select('*')
    .eq('usage_date', date)
    .order('created_at', { ascending: false });
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  if (!costs || costs.length === 0) {
    return Response.json({
      date,
      total_cost: 0,
      total_tokens: 0,
      session_count: 0,
      by_agent: {},
      by_model: {},
      hourly_breakdown: [],
      sessions: []
    });
  }
  
  // Calculate totals
  const totalCost = costs.reduce((sum: number, c: CostRecord) => sum + parseFloat(c.estimated_cost_usd), 0);
  const totalTokens = costs.reduce((sum: number, c: CostRecord) => sum + c.total_tokens, 0);
  
  // Group by agent
  const byAgent: Record<string, { cost: number; tokens: number }> = {};
  costs.forEach((c: CostRecord) => {
    const agent = c.agent_name || 'Unknown';
    if (!byAgent[agent]) {
      byAgent[agent] = { cost: 0, tokens: 0 };
    }
    byAgent[agent].cost += parseFloat(c.estimated_cost_usd);
    byAgent[agent].tokens += c.total_tokens;
  });
  
  // Group by model
  const byModel: Record<string, { cost: number; tokens: number }> = {};
  costs.forEach((c: CostRecord) => {
    const model = c.model;
    if (!byModel[model]) {
      byModel[model] = { cost: 0, tokens: 0 };
    }
    byModel[model].cost += parseFloat(c.estimated_cost_usd);
    byModel[model].tokens += c.total_tokens;
  });
  
  // Hourly breakdown
  const hourlyMap: Record<string, number> = {};
  costs.forEach((c: CostRecord) => {
    const hour = new Date(c.created_at).getHours();
    const hourKey = `${hour.toString().padStart(2, '0')}:00`;
    hourlyMap[hourKey] = (hourlyMap[hourKey] || 0) + parseFloat(c.estimated_cost_usd);
  });
  
  const hourlyBreakdown = Object.entries(hourlyMap)
    .map(([hour, cost]) => ({ hour, cost: parseFloat(cost.toFixed(2)) }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
  
  return Response.json({
    date,
    total_cost: parseFloat(totalCost.toFixed(4)),
    total_tokens: totalTokens,
    session_count: costs.length,
    by_agent: byAgent,
    by_model: byModel,
    hourly_breakdown: hourlyBreakdown,
    sessions: costs.slice(0, 20) // Last 20 sessions
  });
}

async function handleSummary(supabase: any) {
  // Get current month date range
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];
  
  const { data: costs, error } = await supabase
    .from('api_costs_realtime')
    .select('estimated_cost_usd, usage_date')
    .gte('usage_date', firstDayStr);
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  if (!costs || costs.length === 0) {
    return Response.json({
      month_total: 0,
      daily_average: 0,
      days_tracked: 0
    });
  }
  
  const monthTotal = costs.reduce((sum: number, c: { estimated_cost_usd: string }) => 
    sum + parseFloat(c.estimated_cost_usd), 0
  );
  
  // Count unique days
  const uniqueDays = new Set(costs.map((c: { usage_date: string }) => c.usage_date));
  const daysTracked = uniqueDays.size;
  const dailyAverage = daysTracked > 0 ? monthTotal / daysTracked : 0;
  
  return Response.json({
    month_total: parseFloat(monthTotal.toFixed(2)),
    daily_average: parseFloat(dailyAverage.toFixed(2)),
    days_tracked: daysTracked
  });
}
