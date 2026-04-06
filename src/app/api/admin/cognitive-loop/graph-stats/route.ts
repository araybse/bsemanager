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
    
    // Get latest entity stats snapshot
    const { data: latestStats, error: statsError } = await supabase
      .from('entity_stats')
      .select('*')
      .order('snapshot_at', { ascending: false })
      .limit(1);
    
    if (statsError) {
      console.error('Entity stats error:', statsError);
    }
    
    // Get entity growth trend (last 30 days)
    const { data: growthTrend, error: trendError } = await supabase
      .from('entity_stats')
      .select('snapshot_at, person_count, company_count, project_count, total_relationships')
      .gte('snapshot_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('snapshot_at', { ascending: true });
    
    // Get contact profiles summary (from knowledge system)
    const { data: contactStats, error: contactError } = await supabase
      .from('contact_profiles')
      .select('company');
    
    const uniqueCompanies = new Set(((contactStats || []) as any[]).map(c => c.company).filter(Boolean));
    const totalContacts = ((contactStats || []) as any[]).length;
    
    // Get relationship breakdown from latest stats
    const latestStatsArray = ((latestStats || []) as any[]);
    const relationshipTypes = latestStatsArray[0]?.relationship_types || {};
    
    // Calculate entity totals
    const stats = latestStatsArray[0] || {
      person_count: 0,
      company_count: 0,
      project_count: 0,
      location_count: 0,
      topic_count: 0,
      total_relationships: 0,
      graph_density: 0,
      avg_connections: 0,
      isolated_nodes: 0,
      top_entities: []
    };
    
    const totalEntities = stats.person_count + stats.company_count + 
                         stats.project_count + stats.location_count + stats.topic_count;
    
    // Entity distribution for pie chart
    const entityDistribution = [
      { name: 'People', value: stats.person_count, color: '#0088FE' },
      { name: 'Companies', value: stats.company_count, color: '#00C49F' },
      { name: 'Projects', value: stats.project_count, color: '#FFBB28' },
      { name: 'Locations', value: stats.location_count, color: '#FF8042' },
      { name: 'Topics', value: stats.topic_count, color: '#8884D8' }
    ].filter(item => item.value > 0);
    
    // Top entities (most connected)
    const topEntities = stats.top_entities || [];
    
    // Growth metrics (compare to 7 days ago)
    const growthTrendArray = ((growthTrend || []) as any[]);
    const sevenDaysAgo = growthTrendArray.find(s => {
      const date = new Date(s.snapshot_at);
      const target = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return Math.abs(date.getTime() - target.getTime()) < 24 * 60 * 60 * 1000; // within 1 day
    });
    
    const entityGrowth7d = sevenDaysAgo 
      ? totalEntities - (sevenDaysAgo.person_count + sevenDaysAgo.company_count + 
                        sevenDaysAgo.project_count + (sevenDaysAgo as any).location_count + (sevenDaysAgo as any).topic_count)
      : 0;
    
    const relationshipGrowth7d = sevenDaysAgo 
      ? stats.total_relationships - sevenDaysAgo.total_relationships 
      : 0;
    
    return NextResponse.json({
      summary: {
        total_entities: totalEntities,
        total_relationships: stats.total_relationships,
        graph_density: Math.round(stats.graph_density * 10000) / 10000,
        avg_connections: Math.round(stats.avg_connections * 100) / 100,
        isolated_nodes: stats.isolated_nodes,
        entity_growth_7d: entityGrowth7d,
        relationship_growth_7d: relationshipGrowth7d
      },
      entity_counts: {
        person: stats.person_count,
        company: stats.company_count,
        project: stats.project_count,
        location: stats.location_count,
        topic: stats.topic_count
      },
      entity_distribution: entityDistribution,
      relationship_types: relationshipTypes,
      top_entities: topEntities.slice(0, 10),
      growth_trend: growthTrendArray.map(s => ({
        date: new Date(s.snapshot_at).toISOString().split('T')[0],
        entities: s.person_count + s.company_count + s.project_count + 
                 ((s as any).location_count || 0) + ((s as any).topic_count || 0),
        relationships: s.total_relationships
      })) || [],
      contact_stats: {
        total_contacts: totalContacts,
        unique_companies: uniqueCompanies.size
      }
    });
  } catch (error) {
    console.error('Graph stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
