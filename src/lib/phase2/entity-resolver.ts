/**
 * Stream A: Entity Resolution Integration
 * Oliver's backend functions for entity deduplication and merging
 */

import { createClient } from '@/lib/supabase/server'

export interface MatchCandidate {
  id: string
  entityAId: string
  entityBId: string
  entityAType: 'raw' | 'canonical'
  entityBType: 'raw' | 'canonical'
  matchScore: number
  matchReasons: {
    nameSimilarity?: number
    emailMatch?: boolean
    phoneMatch?: boolean
    companySimilarity?: number
  }
  status: 'pending' | 'approved' | 'rejected' | 'auto_merged'
  createdAt: string
  entityAData?: any
  entityBData?: any
}

export interface MergeResult {
  survivorId: string
  mergedId: string
  affectedRelationships: number
  affectedActions: number
}

/**
 * Get pending entity match candidates for review
 */
export async function getPendingReviews(limit: number = 50): Promise<MatchCandidate[]> {
  const supabase = await createClient()
  
  // Query entity_match_candidates table
  const { data, error } = await supabase
    .from('entity_match_candidates')
    .select('*')
    .eq('status', 'pending')
    .order('match_score', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error fetching pending reviews:', error)
    return []
  }
  
  // Transform to MatchCandidate format
  return (data || []).map((row: any) => ({
    id: row.id,
    entityAId: row.entity_a_id,
    entityBId: row.entity_b_id,
    entityAType: row.entity_a_type,
    entityBType: row.entity_b_type,
    matchScore: row.match_score,
    matchReasons: row.match_reasons || {},
    status: row.status,
    createdAt: row.created_at
  }))
}

/**
 * Merge two entities
 */
export async function mergeEntities(
  survivorId: string,
  mergedId: string,
  mergedBy: string = 'system'
): Promise<MergeResult> {
  const supabase = await createClient()
  
  // Call the merge_entities RPC function
  const { data, error } = await (supabase as any).rpc('merge_entities', {
    p_survivor_id: survivorId,
    p_merged_id: mergedId,
    p_merged_by: mergedBy
  })
  
  if (error) {
    console.error('Error merging entities:', error)
    throw new Error(`Failed to merge entities: ${error.message}`)
  }
  
  // Count affected relationships and actions
  const { count: relCount } = await supabase
    .from('canonical_relationships')
    .select('*', { count: 'exact', head: true })
    .or(`from_entity_id.eq.${survivorId},to_entity_id.eq.${survivorId}`)
  
  const { count: actionCount } = await supabase
    .from('canonical_actions')
    .select('*', { count: 'exact', head: true })
    .or(`owner_entity_id.eq.${survivorId},assignee_entity_id.eq.${survivorId}`)
  
  return {
    survivorId,
    mergedId,
    affectedRelationships: relCount || 0,
    affectedActions: actionCount || 0
  }
}

/**
 * Reject a match candidate
 */
export async function rejectMatch(matchId: string, reason?: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await (supabase
    .from('entity_match_candidates') as any)
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'current_user' // TODO: Get from session
    })
    .eq('id', matchId)
  
  if (error) {
    throw new Error(`Failed to reject match: ${error.message}`)
  }
  
  // Optionally record the rejection reason
  if (reason) {
    await (supabase.from('merge_corrections') as any).insert({
      correction_type: 'should_not_merge',
      entity_a_id: matchId, // This would need the actual entity IDs
      entity_b_id: matchId,
      original_decision: 'merge_suggested',
      correct_decision: 'keep_separate',
      reason,
      corrected_by: 'current_user'
    })
  }
}

/**
 * Approve a match and trigger merge
 */
export async function approveMatch(matchId: string): Promise<MergeResult> {
  const supabase = await createClient()
  
  // Get the match candidate details
  const { data: match, error: fetchError } = await supabase
    .from('entity_match_candidates')
    .select('*')
    .eq('id', matchId)
    .single()
  
  if (fetchError || !match) {
    throw new Error('Match candidate not found')
  }
  
  // Mark as approved
  await (supabase
    .from('entity_match_candidates') as any)
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'current_user'
    })
    .eq('id', matchId)
  
  // Perform the merge
  return await mergeEntities((match as any).entity_a_id, (match as any).entity_b_id, 'current_user')
}

/**
 * Get entity details by ID
 */
export async function getEntityById(entityId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('canonical_entities')
    .select('*')
    .eq('id', entityId)
    .single()
  
  if (error) {
    console.error('Error fetching entity:', error)
    return null
  }
  
  return data
}
