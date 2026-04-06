/**
 * Stream B: Relationship Evolution Integration
 * Sebastian's backend functions for relationship tracking and inference
 */

import { createClient } from '@/lib/supabase/server'

export interface Relationship {
  id: string
  fromEntityId: string
  toEntityId: string
  relationshipType: string
  currentStrength: number
  currentStatus: 'active' | 'inactive' | 'unknown'
  isInferred: boolean
  inferenceConfidence?: number
  lastInteractionAt?: string
  interactionCount: number
  createdAt: string
  updatedAt: string
}

export interface RelationshipHistory {
  timestamp: string
  strength: number
  changeType: 'interaction' | 'inference' | 'decay' | 'manual'
  changeSource?: string
}

export interface GraphNode {
  id: string
  name: string
  type: string
  strength?: number
}

export interface GraphEdge {
  from: string
  to: string
  type: string
  strength: number
  label?: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Get all relationships for an entity
 */
export async function getEntityRelationships(entityId: string): Promise<Relationship[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('canonical_relationships')
    .select('*')
    .or(`from_entity_id.eq.${entityId},to_entity_id.eq.${entityId}`)
    .order('current_strength', { ascending: false })
  
  if (error) {
    console.error('Error fetching relationships:', error)
    return []
  }
  
  return (data || []).map((row: any) => ({
    id: row.id,
    fromEntityId: row.from_entity_id,
    toEntityId: row.to_entity_id,
    relationshipType: row.relationship_type,
    currentStrength: row.current_strength,
    currentStatus: row.current_status,
    isInferred: row.is_inferred,
    inferenceConfidence: row.inference_confidence,
    lastInteractionAt: row.last_interaction_at,
    interactionCount: row.interaction_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

/**
 * Get relationship history
 */
export async function getRelationshipHistory(relationshipId: string): Promise<RelationshipHistory[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('relationship_history')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('recorded_at', { ascending: false })
    .limit(50)
  
  if (error) {
    console.error('Error fetching relationship history:', error)
    return []
  }
  
  return (data || []).map((row: any) => ({
    timestamp: row.recorded_at,
    strength: row.strength,
    changeType: row.change_type,
    changeSource: row.change_source
  }))
}

/**
 * Record an interaction between entities
 */
export async function recordInteraction(
  fromEntityId: string,
  toEntityId: string,
  relationshipType: string,
  source?: string
): Promise<string | null> {
  const supabase = await createClient()
  
  const { data, error } = await (supabase as any).rpc('record_interaction', {
    p_from_entity_id: fromEntityId,
    p_to_entity_id: toEntityId,
    p_relationship_type: relationshipType,
    p_interaction_strength: 0.1,
    p_source: source
  })
  
  if (error) {
    console.error('Error recording interaction:', error)
    return null
  }
  
  return data
}

/**
 * Get graph data for visualization (entity + N-hop neighbors)
 */
export async function getEntityGraph(entityId: string, maxHops: number = 2): Promise<GraphData> {
  const supabase = await createClient()
  
  // Use the find_connected_entities RPC function
  const { data: connectedEntities, error } = await (supabase as any).rpc('find_connected_entities', {
    p_entity_id: entityId,
    p_max_hops: maxHops,
    p_min_strength: 0.3
  })
  
  if (error) {
    console.error('Error fetching connected entities:', error)
    return { nodes: [], edges: [] }
  }
  
  // Get the center entity
  const { data: centerEntity } = await supabase
    .from('canonical_entities')
    .select('*')
    .eq('id', entityId)
    .single()
  
  const nodes: GraphNode[] = [
    {
      id: entityId,
      name: (centerEntity as any)?.canonical_name || 'Unknown',
      type: (centerEntity as any)?.entity_type || 'unknown'
    }
  ]
  
  const edges: GraphEdge[] = []
  const nodeIds = new Set([entityId])
  
  // Add connected entities
  for (const conn of connectedEntities || []) {
    if (!nodeIds.has(conn.entity_id)) {
      nodes.push({
        id: conn.entity_id,
        name: conn.entity_name,
        type: conn.entity_type,
        strength: conn.connection_strength
      })
      nodeIds.add(conn.entity_id)
    }
    
    // Get the actual relationships to create edges
    const { data: relationships } = await supabase
      .from('canonical_relationships')
      .select('*')
      .or(`and(from_entity_id.eq.${entityId},to_entity_id.eq.${conn.entity_id}),and(from_entity_id.eq.${conn.entity_id},to_entity_id.eq.${entityId})`)
    
    for (const rel of relationships || []) {
      edges.push({
        from: (rel as any).from_entity_id,
        to: (rel as any).to_entity_id,
        type: (rel as any).relationship_type,
        strength: (rel as any).current_strength,
        label: (rel as any).relationship_type.replace(/_/g, ' ')
      })
    }
  }
  
  return { nodes, edges }
}

/**
 * Infer new relationships based on patterns
 */
export async function inferRelationships(entityId: string): Promise<Relationship[]> {
  const supabase = await createClient()
  
  // Get pending inferences for this entity
  const { data, error } = await supabase
    .from('relationship_inferences')
    .select('*')
    .or(`from_entity_id.eq.${entityId},to_entity_id.eq.${entityId}`)
    .eq('status', 'pending')
    .order('confidence', { ascending: false })
  
  if (error) {
    console.error('Error fetching inferences:', error)
    return []
  }
  
  // Convert inferences to relationship format
  return (data || []).map((inf: any) => ({
    id: inf.id,
    fromEntityId: inf.from_entity_id,
    toEntityId: inf.to_entity_id,
    relationshipType: inf.inferred_type,
    currentStrength: inf.confidence,
    currentStatus: 'unknown' as const,
    isInferred: true,
    inferenceConfidence: inf.confidence,
    interactionCount: 0,
    createdAt: inf.created_at,
    updatedAt: inf.created_at
  }))
}
