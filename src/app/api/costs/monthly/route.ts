import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
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
  
  // Get all costs from api_costs (CSV backfill data)
  const { data: costs, error } = await supabase
    .from('api_costs')
    .select('cost_usd, model, usage_date, token_type')
    .order('usage_date') as { data: Array<{ cost_usd: string; model: string; usage_date: string; token_type: string }> | null, error: any };
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  if (!costs || costs.length === 0) {
    return Response.json({ 
      monthly: [], 
      by_model: {},
      total: 0
    });
  }
  
  // Group by month
  const monthlyMap: Record<string, number> = {};
  const modelMap: Record<string, number> = {};
  let total = 0;
  
  costs.forEach(c => {
    const cost = parseFloat(c.cost_usd);
    const month = c.usage_date.substring(0, 7); // YYYY-MM
    
    monthlyMap[month] = (monthlyMap[month] || 0) + cost;
    modelMap[c.model] = (modelMap[c.model] || 0) + cost;
    total += cost;
  });
  
  // Convert to array sorted by month
  const monthly = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cost]) => {
      // Parse month for display
      const [year, monthNum] = month.split('-');
      const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', { 
        month: 'long',
        year: 'numeric'
      });
      
      return {
        month,
        monthName,
        cost: parseFloat(cost.toFixed(2))
      };
    });
  
  return Response.json({
    monthly,
    by_model: modelMap,
    total: parseFloat(total.toFixed(2)),
    record_count: costs.length
  });
}
