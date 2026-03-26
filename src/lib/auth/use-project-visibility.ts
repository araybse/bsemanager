'use client'

import { useAuth } from '@/components/providers/auth-provider'
import { useCallback } from 'react'

/**
 * Hook to filter projects based on user visibility permissions
 * 
 * - Admin: can see all projects
 * - PM: can see projects where they're PM or assigned to team
 * - Employee: can see projects they're assigned to
 * - Client: cannot see projects list
 */
export function useProjectVisibility() {
  const { role, assignedProjectIds } = useAuth()

  const canViewProject = useCallback((projectId: number) => {
    if (!role) return false
    if (role === 'admin') return true
    // PM and Employee can only see assigned projects
    return assignedProjectIds.includes(projectId)
  }, [role, assignedProjectIds])

  const filterProjectsForRole = useCallback((projects: Array<{ id: number | bigint }>) => {
    if (!role) return []
    if (role === 'admin') return projects
    // Filter to only assigned projects
    return projects.filter(p => {
      const id = typeof p.id === 'number' ? p.id : Number(p.id)
      return assignedProjectIds.includes(id)
    })
  }, [role, assignedProjectIds])

  return {
    canViewProject,
    filterProjectsForRole,
    canCreateProject: role === 'admin',
    canSeeFullList: role === 'admin',
    assignedProjectIds,
    role,
  }
}
