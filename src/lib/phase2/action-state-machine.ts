/**
 * Stream C: Action Lifecycle Integration
 * Sophia's backend functions for action status tracking
 */

import { createClient } from '@/lib/supabase/server'

export type ActionStatus = 
  | 'extracted'
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'overdue'

export interface Action {
  id: string
  actionType: string
  description: string
  currentStatus: ActionStatus
  statusConfidence: number
  dueDate?: string
  completedAt?: string
  ownerEntityId?: string
  assigneeEntityId?: string
  relatedEntities: string[]
  sourceEmailIds: string[]
  priority?: 'low' | 'medium' | 'high' | 'critical'
  tags: string[]
  attributes: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface StatusUpdate {
  actionId: string
  previousStatus: ActionStatus
  newStatus: ActionStatus
  statusConfidence: number
  changeSource: string
  changeEvidence?: string
  changedAt: string
  changedBy: string
}

/**
 * Get actions with optional filters
 */
export async function getActionsByStatus(
  status?: ActionStatus,
  options?: {
    ownerId?: string
    assigneeId?: string
    limit?: number
    offset?: number
  }
): Promise<Action[]> {
  const supabase = await createClient()
  
  let query = supabase
    .from('canonical_actions')
    .select('*')
  
  if (status) {
    query = query.eq('current_status', status)
  }
  
  if (options?.ownerId) {
    query = query.eq('owner_entity_id', options.ownerId)
  }
  
  if (options?.assigneeId) {
    query = query.eq('assignee_entity_id', options.assigneeId)
  }
  
  query = query
    .order('created_at', { ascending: false })
    .limit(options?.limit || 100)
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 100) - 1)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching actions:', error)
    return []
  }
  
  return (data || []).map((row: any) => ({
    id: row.id,
    actionType: row.action_type,
    description: row.description,
    currentStatus: row.current_status as ActionStatus,
    statusConfidence: row.status_confidence,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    ownerEntityId: row.owner_entity_id,
    assigneeEntityId: row.assignee_entity_id,
    relatedEntities: row.related_entities || [],
    sourceEmailIds: row.source_email_ids || [],
    priority: row.priority,
    tags: row.tags || [],
    attributes: row.attributes || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

/**
 * Get overdue actions
 */
export async function getOverdueActions(limit: number = 50): Promise<Action[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('canonical_actions')
    .select('*')
    .eq('current_status', 'overdue')
    .order('due_date', { ascending: true })
    .limit(limit)
  
  if (error) {
    console.error('Error fetching overdue actions:', error)
    return []
  }
  
  return (data || []).map((row: any) => ({
    id: row.id,
    actionType: row.action_type,
    description: row.description,
    currentStatus: row.current_status,
    statusConfidence: row.status_confidence,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    ownerEntityId: row.owner_entity_id,
    assigneeEntityId: row.assignee_entity_id,
    relatedEntities: row.related_entities || [],
    sourceEmailIds: row.source_email_ids || [],
    priority: row.priority,
    tags: row.tags || [],
    attributes: row.attributes || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

/**
 * Change action status
 */
export async function changeActionStatus(
  actionId: string,
  newStatus: ActionStatus,
  evidence?: string,
  changedBy: string = 'system'
): Promise<StatusUpdate> {
  const supabase = await createClient()
  
  // Get current action state
  const { data: action } = await supabase
    .from('canonical_actions')
    .select('current_status')
    .eq('id', actionId)
    .single()
  
  if (!action) {
    throw new Error('Action not found')
  }
  
  const previousStatus = (action as any).current_status
  
  // Call update_action_status RPC function
  const { error } = await (supabase as any).rpc('update_action_status', {
    p_action_id: actionId,
    p_new_status: newStatus,
    p_confidence: 1.0,
    p_source: 'manual',
    p_evidence: evidence || null,
    p_source_email_id: null,
    p_changed_by: changedBy
  })
  
  if (error) {
    throw new Error(`Failed to update action status: ${error.message}`)
  }
  
  return {
    actionId,
    previousStatus,
    newStatus,
    statusConfidence: 1.0,
    changeSource: 'manual',
    changeEvidence: evidence,
    changedAt: new Date().toISOString(),
    changedBy
  }
}

/**
 * Get action status history
 */
export async function getActionHistory(actionId: string): Promise<StatusUpdate[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('action_status_history')
    .select('*')
    .eq('action_id', actionId)
    .order('changed_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching action history:', error)
    return []
  }
  
  return (data || []).map((row: any) => ({
    actionId: row.action_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    statusConfidence: row.status_confidence,
    changeSource: row.change_source,
    changeEvidence: row.change_evidence,
    changedAt: row.changed_at,
    changedBy: row.changed_by
  }))
}

/**
 * Find matching actions for deduplication
 */
export async function findMatchingActions(
  description: string,
  ownerId?: string
): Promise<Action[]> {
  const supabase = await createClient()
  
  const { data, error } = await (supabase as any).rpc('find_matching_action', {
    p_description: description,
    p_owner_id: ownerId || null,
    p_due_date: null,
    p_threshold: 0.7
  })
  
  if (error) {
    console.error('Error finding matching actions:', error)
    return []
  }
  
  // Get full action details
  const actionIds = (data || []).map((match: any) => match.action_id)
  
  if (actionIds.length === 0) {
    return []
  }
  
  const { data: actions } = await supabase
    .from('canonical_actions')
    .select('*')
    .in('id', actionIds)
  
  return (actions || []).map((row: any) => ({
    id: row.id,
    actionType: row.action_type,
    description: row.description,
    currentStatus: row.current_status,
    statusConfidence: row.status_confidence,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    ownerEntityId: row.owner_entity_id,
    assigneeEntityId: row.assignee_entity_id,
    relatedEntities: row.related_entities || [],
    sourceEmailIds: row.source_email_ids || [],
    priority: row.priority,
    tags: row.tags || [],
    attributes: row.attributes || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

/**
 * Detect status from email text (simplified version)
 */
export async function detectStatusFromEmail(emailId: string, emailText: string): Promise<StatusUpdate | null> {
  // This would use pattern matching against status_patterns table
  // For now, simplified version with keyword detection
  
  const completionKeywords = ['done', 'completed', 'finished', 'delivered']
  const blockingKeywords = ['waiting', 'blocked', 'pending', 'need']
  const progressKeywords = ['working on', 'in progress', 'started']
  
  const textLower = emailText.toLowerCase()
  
  let detectedStatus: ActionStatus | null = null
  
  if (completionKeywords.some(kw => textLower.includes(kw))) {
    detectedStatus = 'completed'
  } else if (blockingKeywords.some(kw => textLower.includes(kw))) {
    detectedStatus = 'blocked'
  } else if (progressKeywords.some(kw => textLower.includes(kw))) {
    detectedStatus = 'in_progress'
  }
  
  if (!detectedStatus) {
    return null
  }
  
  // Would need to link email to action and update
  // This is a simplified placeholder
  return {
    actionId: 'unknown',
    previousStatus: 'pending',
    newStatus: detectedStatus,
    statusConfidence: 0.7,
    changeSource: 'email_detection',
    changeEvidence: emailText.substring(0, 100),
    changedAt: new Date().toISOString(),
    changedBy: 'system'
  }
}
