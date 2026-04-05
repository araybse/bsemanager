import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
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
  
  // Get all-time stats
  const { data: allCosts } = await supabase
    .from('api_cost_log')
    .select('cost_usd, model, category, project') as { data: Array<{ cost_usd: string; model: string; category: string; project: string | null }> | null };
  
  if (!allCosts || allCosts.length === 0) {
    return Response.json({
      totalSpend: 0,
      totalCalls: 0,
      avgCost: 0,
      byModel: {},
      mostExpensiveProject: null
    });
  }
  
  const totalSpend = allCosts.reduce((sum, c) => sum + parseFloat(c.cost_usd), 0);
  const totalCalls = allCosts.length;
  const avgCost = totalCalls > 0 ? totalSpend / totalCalls : 0;
  
  const byModel = allCosts.reduce((acc, c) => {
    acc[c.model] = (acc[c.model] || 0) + parseFloat(c.cost_usd);
    return acc;
  }, {} as Record<string, number>);
  
  const projectCosts = allCosts.reduce((acc, c) => {
    if (c.project) {
      acc[c.project] = (acc[c.project] || 0) + parseFloat(c.cost_usd);
    }
    return acc;
  }, {} as Record<string, number>);
  
  const mostExpensiveProject = Object.entries(projectCosts)
    .sort(([, a], [, b]) => b - a)[0];
  
  return Response.json({
    totalSpend,
    totalCalls,
    avgCost,
    byModel,
    mostExpensiveProject: mostExpensiveProject 
      ? { project: mostExpensiveProject[0], cost: mostExpensiveProject[1] }
      : null
  });
}
