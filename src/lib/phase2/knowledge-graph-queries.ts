/**
 * Stream D: Knowledge Graph Query Integration
 * Henry's backend functions for graph traversal and pattern detection
 */

import { createClient } from '@/lib/supabase/server'

export interface ConnectedEntity {
  entityId: string
  entityName: string
  entityType: string
  hopDistance: number
  connectionStrength: number
  pathThrough: string[]
}

export interface EntityPath {
  pathLength: number
  entities: string[]
  totalStrength: number
}

export interface NetworkSummary {
  entity: any
  directConnections: number
  strongConnections: number
  pendingActions: number
  relationshipTypes: string[]
}

export interface GraphPattern {
  id: string
  name: string
  type: 'cluster' | 'chain' | 'hub' | 'bridge'
  entities: string[]
  strength: number
  metadata: Record<string, any>
}

export interface QueryResult {
  results: any[]
  confidence: number
  sources: string[]
  relatedEntities?: string[]
  relatedActions?: string[]
}

export interface ProjectKnowledge {
  project: any
  team: ConnectedEntity[]
  permits: any[]
  keyDecisions: any[]
  actionItems: any[]
  recentActivity: any[]
}

/**
 * Natural language knowledge graph query
 */
export async function parseAndExecute(query: string): Promise<QueryResult> {
  const supabase = await createClient()
  
  // Simplified NL parsing - in production would use LLM or NLP
  const queryLower = query.toLowerCase()
  
  // Pattern: "Who works on [project]?"
  if (queryLower.includes('who works on') || queryLower.includes('team')) {
    const projectMatch = query.match(/(?:on|for)\s+([a-z0-9\-]+)/i)
    if (projectMatch) {
      const projectNumber = projectMatch[1]
      
      // Find project entity
      const { data: projectEntity } = await supabase
        .from('canonical_entities')
        .select('*')
        .eq('entity_type', 'project')
        .ilike('canonical_name', `%${projectNumber}%`)
        .limit(1)
        .single()
      
      if (projectEntity) {
        // Get team members (people with WORKS_ON relationships)
        const { data: relationships } = await supabase
          .from('canonical_relationships')
          .select(`
            *,
            from_entity:canonical_entities!from_entity_id(*)
          `)
          .eq('to_entity_id', (projectEntity as any).id)
          .eq('relationship_type', 'WORKS_ON')
        
        const team = relationships?.map((rel: any) => rel.from_entity) || []
        
        return {
          results: team,
          confidence: 0.9,
          sources: ['canonical_relationships'],
          relatedEntities: team.map(t => t.id)
        }
      }
    }
  }
  
  // Pattern: "What's the status of [action/project]?"
  if (queryLower.includes('status')) {
    // Search canonical_actions
    const { data: actions } = await supabase
      .from('canonical_actions')
      .select('*')
      .ilike('description', `%${query.split('status of ')[1] || ''}%`)
      .limit(5)
    
    return {
      results: actions || [],
      confidence: 0.75,
      sources: ['canonical_actions'],
      relatedActions: (actions || []).map((a: any) => a.id)
    }
  }
  
  // Default: full-text search across entities
  const { data: entities } = await supabase
    .from('canonical_entities')
    .select('*')
    .or(`canonical_name.ilike.%${query}%,canonical_company.ilike.%${query}%`)
    .limit(10)
  
  return {
    results: entities || [],
    confidence: 0.5,
    sources: ['canonical_entities']
  }
}

/**
 * Get connected entities within N hops
 */
export async function findConnectedEntities(
  entityId: string,
  maxHops: number = 2
): Promise<ConnectedEntity[]> {
  const supabase = await createClient()
  
  const { data, error } = await (supabase as any).rpc('find_connected_entities', {
    p_entity_id: entityId,
    p_max_hops: maxHops,
    p_min_strength: 0.3
  })
  
  if (error) {
    console.error('Error finding connected entities:', error)
    return []
  }
  
  return (data || []).map((row: any) => ({
    entityId: row.entity_id,
    entityName: row.entity_name,
    entityType: row.entity_type,
    hopDistance: row.hop_distance,
    connectionStrength: row.connection_strength,
    pathThrough: row.path_through || []
  }))
}

/**
 * Find shortest path between two entities
 */
export async function findPath(fromId: string, toId: string): Promise<EntityPath | null> {
  const supabase = await createClient()
  
  const { data, error } = await (supabase as any).rpc('find_entity_path', {
    p_from_entity_id: fromId,
    p_to_entity_id: toId,
    p_max_depth: 5
  })
  
  if (error || !data || data.length === 0) {
    return null
  }
  
  const path = data[0]
  return {
    pathLength: path.path_length,
    entities: path.path_entities,
    totalStrength: path.path_strength
  }
}

/**
 * Get network summary for an entity
 */
export async function getNetworkSummary(entityId: string): Promise<NetworkSummary | null> {
  const supabase = await createClient()
  
  const { data, error } = await (supabase as any).rpc('get_entity_network_summary', {
    p_entity_id: entityId
  })
  
  if (error || !data) {
    console.error('Error getting network summary:', error)
    return null
  }
  
  return {
    entity: data.entity,
    directConnections: data.direct_connections || 0,
    strongConnections: data.strong_connections || 0,
    pendingActions: data.pending_actions || 0,
    relationshipTypes: data.relationship_types || []
  }
}

/**
 * Detect patterns in the graph
 */
export async function detectPatterns(): Promise<GraphPattern[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('graph_patterns')
    .select('*')
    .eq('is_active', true)
    .order('pattern_strength', { ascending: false })
    .limit(20)
  
  if (error) {
    console.error('Error detecting patterns:', error)
    return []
  }
  
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.pattern_name,
    type: row.pattern_type,
    entities: row.involved_entities || [],
    strength: row.pattern_strength,
    metadata: row.pattern_metadata || {}
  }))
}

/**
 * Get predictive insights for an entity/action
 */
export async function getPredictiveInsights(targetId: string, targetType: 'entity' | 'action' | 'relationship' = 'entity'): Promise<any[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('predictive_insights')
    .select('*')
    .eq('target_id', targetId)
    .eq('target_type', targetType)
    .eq('is_acknowledged', false)
    .order('confidence', { ascending: false })
  
  if (error) {
    console.error('Error fetching insights:', error)
    return []
  }
  
  return data || []
}

/**
 * Get project team members
 */
export async function getProjectTeam(projectId: string): Promise<ConnectedEntity[]> {
  const supabase = await createClient()
  
  // Find the project entity
  const { data: projectEntity } = await supabase
    .from('canonical_entities')
    .select('*')
    .eq('id', projectId)
    .eq('entity_type', 'project')
    .single()
  
  if (!projectEntity) {
    return []
  }
  
  // Get people with WORKS_ON relationships
  const { data: relationships } = await supabase
    .from('canonical_relationships')
    .select(`
      *,
      from_entity:canonical_entities!from_entity_id(*)
    `)
    .eq('to_entity_id', projectId)
    .in('relationship_type', ['WORKS_ON', 'MANAGES', 'ASSIGNED_TO'])
  
  return (relationships || []).map((rel: any) => ({
    entityId: rel.from_entity.id,
    entityName: rel.from_entity.canonical_name,
    entityType: rel.from_entity.entity_type,
    hopDistance: 1,
    connectionStrength: rel.current_strength,
    pathThrough: [projectId]
  }))
}

/**
 * Get comprehensive project knowledge
 */
export async function getProjectKnowledge(projectId: string): Promise<ProjectKnowledge | null> {
  const supabase = await createClient()
  
  // Get project details
  const { data: project } = await supabase
    .from('canonical_entities')
    .select('*')
    .eq('id', projectId)
    .single()
  
  if (!project) {
    return null
  }
  
  // Get team
  const team = await getProjectTeam(projectId)
  
  // Get related actions
  const { data: actions } = await supabase
    .from('canonical_actions')
    .select('*')
    .contains('related_entities', [projectId])
    .order('created_at', { ascending: false })
    .limit(20)
  
  // Get permits (actions of type permit/approval)
  const permits = (actions || []).filter((a: any) => 
    a.action_type.toLowerCase().includes('permit') ||
    a.action_type.toLowerCase().includes('approval')
  )
  
  // Get action items (pending/in progress)
  const actionItems = (actions || []).filter((a: any) => 
    ['pending', 'in_progress'].includes(a.current_status)
  )
  
  return {
    project,
    team,
    permits,
    keyDecisions: [], // Would come from specific entity type
    actionItems,
    recentActivity: actions || []
  }
}
