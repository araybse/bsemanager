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
  
  // Get all-time stats from api_costs (CSV backfill data)
  const { data: allCosts } = await supabase
    .from('api_costs')
    .select('cost_usd, model, token_type, workspace') as { data: Array<{ cost_usd: string; model: string; token_type: string; workspace: string | null }> | null };
  
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
  
  // Group by token_type instead of project (api_costs doesn't have project)
  const byTokenType = allCosts.reduce((acc, c) => {
    acc[c.token_type] = (acc[c.token_type] || 0) + parseFloat(c.cost_usd);
    return acc;
  }, {} as Record<string, number>);
  
  const mostExpensiveModel = Object.entries(byModel)
    .sort(([, a], [, b]) => b - a)[0];
  
  return Response.json({
    totalSpend,
    totalCalls,
    avgCost,
    byModel,
    byTokenType,
    mostExpensiveProject: mostExpensiveModel 
      ? { project: mostExpensiveModel[0], cost: mostExpensiveModel[1] }
      : null
  });
}
