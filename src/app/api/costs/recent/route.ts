import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '20');
  
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
  
  // Query api_costs table and transform to expected format
  const { data: rawCosts } = await supabase
    .from('api_costs')
    .select('id, usage_date, model, workspace, token_type, cost_usd, created_at')
    .order('usage_date', { ascending: false })
    .limit(limit) as { data: Array<{ id: number; usage_date: string; model: string; workspace: string | null; token_type: string; cost_usd: string; created_at: string }> | null };
  
  // Transform to match expected frontend format
  const costs = (rawCosts || []).map(c => ({
    id: c.id,
    timestamp: c.usage_date,
    operation: c.token_type,
    model: c.model,
    category: c.workspace || 'claude_console',
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: c.cost_usd
  }));
  
  return Response.json({ costs });
}
