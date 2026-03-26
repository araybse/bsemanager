'use client'

import { useAuth } from '@/components/providers/auth-provider'
import { useCallback } from 'react'
import {
  canSeePage,
  canSeeProjectTab,
  canSeeSettingsSection,
  canSeeDashboardWidget,
  canSeeTimesheetFeature,
  isFieldHidden,
  getVisiblePages,
  getVisibleProjectTabs,
  canCreateProject,
  canSeeFullProjectList,
  canSeeProjects,
  canManageTeam,
  canSeeCostData,
  canSeeExpenseDetails,
  isAdmin,
  isProjectManagerOrAdmin,
} from './permissions'

/**
 * Hook to check permissions and visibility for current user
 * Usage:
 * 
 * const perms = usePermissions()
 * if (perms.canSeePage('dashboard')) { ... }
 * if (perms.isFieldHidden('labor.amount')) { ... }
 */
export function usePermissions() {
  const { role } = useAuth()

  return {
    // Page visibility
    canSeePage: useCallback((page: string) => canSeePage(page, role), [role]),
    canSeeProjectTab: useCallback((tab: string) => canSeeProjectTab(tab, role), [role]),
    canSeeSettingsSection: useCallback((section: string) => canSeeSettingsSection(section, role), [role]),
    canSeeDashboardWidget: useCallback((widget: string) => canSeeDashboardWidget(widget, role), [role]),
    canSeeTimesheetFeature: useCallback((feature: string) => canSeeTimesheetFeature(feature, role), [role]),

    // Field visibility
    isFieldHidden: useCallback((fieldPath: string) => isFieldHidden(fieldPath, role), [role]),

    // Data visibility
    canCreateProject: useCallback(() => canCreateProject(role), [role]),
    canSeeFullProjectList: useCallback(() => canSeeFullProjectList(role), [role]),
    canSeeProjects: useCallback(() => canSeeProjects(role), [role]),
    canManageTeam: useCallback(() => canManageTeam(role), [role]),
    canSeeCostData: useCallback(() => canSeeCostData(role), [role]),
    canSeeExpenseDetails: useCallback(() => canSeeExpenseDetails(role), [role]),

    // Role checks
    isAdmin: useCallback(() => isAdmin(role), [role]),
    isProjectManagerOrAdmin: useCallback(() => isProjectManagerOrAdmin(role), [role]),

    // Get lists
    getVisiblePages: useCallback(() => getVisiblePages(role), [role]),
    getVisibleProjectTabs: useCallback(() => getVisibleProjectTabs(role), [role]),

    // Raw role
    role,
  }
}

/**
 * Component wrapper to conditionally render based on permissions
 * Usage:
 * <IfCanSee page="dashboard">
 *   <Dashboard />
 * </IfCanSee>
 */
export function IfCanSee({ 
  page, 
  children,
  fallback = null 
}: { 
  page?: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const perms = usePermissions()
  
  if (page && !perms.canSeePage(page)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

/**
 * Conditionally render based on role
 * Usage:
 * <IfRole role="admin">
 *   <AdminPanel />
 * </IfRole>
 */
export function IfRole({ 
  role: requiredRole,
  children,
  fallback = null
}: { 
  role: string | string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { role } = useAuth()
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  
  if (!role || !roles.includes(role)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

/**
 * Conditionally render based on field visibility
 * Usage:
 * <IfFieldVisible fieldPath="labor.amount">
 *   <AmountColumn />
 * </IfFieldVisible>
 */
export function IfFieldVisible({ 
  fieldPath,
  children,
  fallback = null
}: { 
  fieldPath: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const perms = usePermissions()
  
  if (perms.isFieldHidden(fieldPath)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}
