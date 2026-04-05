import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period') || 'month';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const category = searchParams.get('category');
  const project = searchParams.get('project');
  const model = searchParams.get('model');
  
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
  
  // Calculate date range
  const now = new Date();
  let rangeStart: Date;
  
  if (startDate) {
    rangeStart = new Date(startDate);
  } else {
    switch (period) {
      case 'today':
        rangeStart = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        rangeStart = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        rangeStart = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'quarter':
        rangeStart = new Date(now.setMonth(now.getMonth() - 3));
        break;
      default:
        rangeStart = new Date(now.setMonth(now.getMonth() - 1));
    }
  }
  
  // Query costs with filters
  let query = supabase
    .from('api_cost_log')
    .select('cost_usd, category, project, timestamp, model')
    .gte('timestamp', rangeStart.toISOString());
  
  if (endDate) query = query.lte('timestamp', endDate);
  if (category) query = query.eq('category', category);
  if (project) query = query.eq('project', project);
  if (model) query = query.eq('model', model);
  
  const { data: costs } = await query as { data: Array<{ cost_usd: string; category: string; project: string | null; timestamp: string; model: string }> | null };
  
  if (!costs) {
    return Response.json({ total: 0, byCategory: {}, byProject: {}, count: 0 });
  }
  
  // Calculate totals
  const total = costs.reduce((sum, c) => sum + parseFloat(c.cost_usd), 0);
  
  // Group by category
  const byCategory = costs.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + parseFloat(c.cost_usd);
    return acc;
  }, {} as Record<string, number>);
  
  // Group by project
  const byProject = costs.reduce((acc, c) => {
    if (c.project) {
      acc[c.project] = (acc[c.project] || 0) + parseFloat(c.cost_usd);
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Calculate trend (this week vs last week)
  const thisWeekStart = new Date(new Date().setDate(new Date().getDate() - 7));
  const lastWeekStart = new Date(new Date().setDate(new Date().getDate() - 14));
  
  const thisWeekCosts = costs.filter(c => new Date(c.timestamp) >= thisWeekStart);
  const lastWeekCosts = costs.filter(c => 
    new Date(c.timestamp) >= lastWeekStart && new Date(c.timestamp) < thisWeekStart
  );
  
  const thisWeekTotal = thisWeekCosts.reduce((sum, c) => sum + parseFloat(c.cost_usd), 0);
  const lastWeekTotal = lastWeekCosts.reduce((sum, c) => sum + parseFloat(c.cost_usd), 0);
  
  const trend = lastWeekTotal > 0 
    ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 
    : 0;
  
  return Response.json({
    total,
    byCategory,
    byProject,
    count: costs.length,
    trend,
    period
  });
}
