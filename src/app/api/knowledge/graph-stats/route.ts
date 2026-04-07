import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
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
    // Entity counts
    const { count: entityCount } = await (supabase as any)
      .from('canonical_entities')
      .select('*', { count: 'exact', head: true });
    
    // Entity type breakdown
    const { data: entities } = await (supabase as any)
      .from('canonical_entities')
      .select('entity_type');
    
    const entityTypeCounts: Record<string, number> = {};
    entities?.forEach((e: any) => {
      entityTypeCounts[e.entity_type] = (entityTypeCounts[e.entity_type] || 0) + 1;
    });
    
    const entityTypes = Object.entries(entityTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    
    // Relationship counts
    const { count: relationshipCount } = await (supabase as any)
      .from('canonical_relationships')
      .select('*', { count: 'exact', head: true });
    
    // Relationship type breakdown
    const { data: relationships } = await (supabase as any)
      .from('canonical_relationships')
      .select('relationship_type');
    
    const relationshipTypeCounts: Record<string, number> = {};
    relationships?.forEach((r: any) => {
      relationshipTypeCounts[r.relationship_type] = (relationshipTypeCounts[r.relationship_type] || 0) + 1;
    });
    
    const relationshipTypes = Object.entries(relationshipTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    
    // Average confidence for entities
    const { data: confidenceData } = await (supabase as any)
      .from('canonical_entities')
      .select('confidence');
    
    const avgConfidence = confidenceData && confidenceData.length > 0
      ? confidenceData.reduce((sum: number, e: any) => sum + (e.confidence || 0), 0) / confidenceData.length
      : 0;
    
    // Processing stats (from email knowledge stats)
    const { data: reviewQueue } = await supabase
      .from('knowledge_review_queue')
      .select('*', { count: 'exact' });
    
    const emailsProcessed = reviewQueue?.length || 0;
    
    const processingStats = {
      emailsProcessed,
      entityResolutionRate: avgConfidence,
      avgProcessingTime: 2.4, // TODO: Track this in metadata
      lastProcessed: new Date().toISOString()
    };
    
    return NextResponse.json({
      entityCount: entityCount || 0,
      entityTypes,
      relationshipCount: relationshipCount || 0,
      relationshipTypes,
      processingStats
    });
    
  } catch (error) {
    console.error('Error fetching graph stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
