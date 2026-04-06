/**
 * Feedback Capture for Agent Self-Improvement
 * 
 * Logs corrections, approvals, and rejections to build a training dataset
 * for improving agent performance over time.
 */

export interface FeedbackCorrection {
  type: string; // 'project_assignment', 'knowledge_extraction', 'code_generation', etc.
  agentName: string; // 'Sophia', 'Sebastian', 'Oliver', etc.
  original: any; // What the agent originally did/suggested
  corrected: any; // What the user corrected it to
  reason: string; // Why this was wrong
  sourceId: string; // thread_id, task_id, etc.
  severity: 'critical' | 'major' | 'minor' | 'cosmetic';
  userComment?: string;
  confidenceBefore?: number; // 0-100
}

export interface FeedbackApproval {
  type: string;
  agentName: string;
  output: any;
  sourceId: string;
  confidenceWas?: number;
}

export interface FeedbackRejection {
  type: string;
  agentName: string;
  rejected: any;
  reason: string;
  sourceId: string;
  severity: 'critical' | 'major' | 'minor';
}

/**
 * Log a correction made by a user to agent output
 */
export async function logCorrection(correction: FeedbackCorrection): Promise<void> {
  try {
    const response = await fetch('/api/feedback/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedbackType: 'correction',
        ...correction
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Failed to log correction:', error);
    }
  } catch (error) {
    // Fail silently - don't break user experience
    console.error('Error logging correction:', error);
  }
}

/**
 * Log user approval of agent output
 */
export async function logApproval(approval: FeedbackApproval): Promise<void> {
  try {
    const response = await fetch('/api/feedback/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedbackType: 'approval',
        ...approval
      })
    });
    
    if (!response.ok) {
      console.error('Failed to log approval');
    }
  } catch (error) {
    console.error('Error logging approval:', error);
  }
}

/**
 * Log user rejection of agent output
 */
export async function logRejection(rejection: FeedbackRejection): Promise<void> {
  try {
    const response = await fetch('/api/feedback/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedbackType: 'rejection',
        ...rejection
      })
    });
    
    if (!response.ok) {
      console.error('Failed to log rejection');
    }
  } catch (error) {
    console.error('Error logging rejection:', error);
  }
}

/**
 * Log user escalation (when agent can't handle something)
 */
export async function logEscalation(data: {
  agentName: string;
  taskType: string;
  reason: string;
  sourceId: string;
  metadata?: any;
}): Promise<void> {
  try {
    const response = await fetch('/api/feedback/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedbackType: 'escalation',
        ...data
      })
    });
    
    if (!response.ok) {
      console.error('Failed to log escalation');
    }
  } catch (error) {
    console.error('Error logging escalation:', error);
  }
}
