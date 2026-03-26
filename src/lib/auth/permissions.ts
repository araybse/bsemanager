/**
 * Role-Based Permissions and Visibility System
 * 
 * Based on BSE Manager Permissions Matrix (March 26, 2026)
 * Defines what each role can see and do across the application
 */

import { UserRole } from '@/lib/types/database'

export type PageVisibility = 'visible' | 'hidden'
export type DataVisibility = 'visible' | 'hidden'

/**
 * Page visibility rules per role
 * Determines which pages appear in navigation and are accessible
 */
export const PAGE_VISIBILITY: Record<string, Record<UserRole, PageVisibility>> = {
  'dashboard': { admin: 'visible', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
  'proposals': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'projects': { admin: 'visible', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
  'time-entries': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'timesheet': { admin: 'visible', project_manager: 'visible', employee: 'visible', client: 'hidden' },
  'billables-report': { admin: 'visible', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
  'invoices': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'accounting': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'cash-flow': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'expenses': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'contract-labor': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'settings': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'data-quality': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'contracts': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'rates': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'clients': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'reimbursables': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'unbilled': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'cam': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
}

/**
 * Project detail page tabs visibility per role
 * Only applicable if user has access to the project
 */
export const PROJECT_TAB_VISIBILITY: Record<string, Record<UserRole, DataVisibility>> = {
  'dashboard': { admin: 'visible', project_manager: 'visible', employee: 'visible', client: 'visible' },
  'project-info': { admin: 'visible', project_manager: 'visible', employee: 'visible', client: 'visible' },
  'team': { admin: 'visible', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
  'agencies-permits': { admin: 'visible', project_manager: 'visible', employee: 'visible', client: 'visible' },
  'applications': { admin: 'visible', project_manager: 'visible', employee: 'visible', client: 'visible' },
  'phases': { admin: 'visible', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
  'billables': { admin: 'visible', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
  'invoices': { admin: 'visible', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
  'labor': { admin: 'visible', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
  'expenses': { admin: 'visible', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
  'contracts': { admin: 'visible', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
}

/**
 * Sensitive fields that should be hidden from certain roles
 */
export const HIDDEN_FIELDS: Record<UserRole, string[]> = {
  admin: [],
  project_manager: [
    'labor.amount', // Salary visibility prevention
    'settings.qb_settings',
    'settings.api_keys',
    'settings.sync_controls',
  ],
  employee: [
    'labor.amount',
    'billables.rate', // Cost data
    'settings.qb_settings',
    'settings.api_keys',
    'settings.sync_controls',
    'labor.cost',
    'billables.cost',
  ],
  client: [
    'labor.amount',
    'labor.cost',
    'billables.rate',
    'billables.cost',
    'settings.qb_settings',
    'settings.api_keys',
    'settings.sync_controls',
  ],
}

/**
 * Settings page visibility rules
 */
export const SETTINGS_VISIBILITY: Record<string, Record<UserRole, DataVisibility>> = {
  'users': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'sync': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'schedule-of-rates': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'clients': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'project-info': { admin: 'visible', project_manager: 'visible', employee: 'visible', client: 'visible' },
  'agencies-permits': { admin: 'visible', project_manager: 'visible', employee: 'visible', client: 'visible' },
}

/**
 * Dashboard widget visibility per role
 */
export const DASHBOARD_WIDGET_VISIBILITY: Record<string, Record<UserRole, DataVisibility>> = {
  'my-projects': { admin: 'hidden', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
  'monthly-performance': { admin: 'visible', project_manager: 'visible', employee: 'hidden', client: 'hidden' },
  'projects-ready-to-build': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'revenue-trend': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'cash-basis-profit-expenses': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
}

/**
 * Timesheet page visibility rules
 */
export const TIMESHEET_FEATURE_VISIBILITY: Record<string, Record<UserRole, DataVisibility>> = {
  'view-own-timesheet': { admin: 'hidden', project_manager: 'visible', employee: 'visible', client: 'hidden' },
  'edit-own-entries': { admin: 'hidden', project_manager: 'visible', employee: 'visible', client: 'hidden' },
  'employee-dropdown': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'view-any-employee': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'edit-any-employee': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
  'delete-any-employee': { admin: 'visible', project_manager: 'hidden', employee: 'hidden', client: 'hidden' },
}

/**
 * Check if a role can see a specific page
 */
export function canSeePage(page: string, role: UserRole | null): boolean {
  if (!role) return false
  if (role === 'admin') return true
  return PAGE_VISIBILITY[page]?.[role] === 'visible'
}

/**
 * Check if a role can see a specific project tab
 */
export function canSeeProjectTab(tab: string, role: UserRole | null): boolean {
  if (!role) return false
  if (role === 'admin') return true
  return PROJECT_TAB_VISIBILITY[tab]?.[role] === 'visible'
}

/**
 * Check if a role can see a specific settings section
 */
export function canSeeSettingsSection(section: string, role: UserRole | null): boolean {
  if (!role) return false
  if (role === 'admin') return true
  return SETTINGS_VISIBILITY[section]?.[role] === 'visible'
}

/**
 * Check if a role can see a dashboard widget
 */
export function canSeeDashboardWidget(widget: string, role: UserRole | null): boolean {
  if (!role) return false
  if (role === 'admin') return true
  return DASHBOARD_WIDGET_VISIBILITY[widget]?.[role] === 'visible'
}

/**
 * Check if a role can see a timesheet feature
 */
export function canSeeTimesheetFeature(feature: string, role: UserRole | null): boolean {
  if (!role) return false
  if (role === 'admin') return true
  return TIMESHEET_FEATURE_VISIBILITY[feature]?.[role] === 'visible'
}

/**
 * Check if a field should be hidden for a role
 */
export function isFieldHidden(fieldPath: string, role: UserRole | null): boolean {
  if (!role || role === 'admin') return false
  return HIDDEN_FIELDS[role]?.includes(fieldPath) || false
}

/**
 * Get all visible pages for a role
 */
export function getVisiblePages(role: UserRole | null): string[] {
  if (!role) return []
  if (role === 'admin') return Object.keys(PAGE_VISIBILITY)
  return Object.entries(PAGE_VISIBILITY)
    .filter(([_, visibility]) => visibility[role] === 'visible')
    .map(([page, _]) => page)
}

/**
 * Get all visible project tabs for a role
 */
export function getVisibleProjectTabs(role: UserRole | null): string[] {
  if (!role) return []
  if (role === 'admin') return Object.keys(PROJECT_TAB_VISIBILITY)
  return Object.entries(PROJECT_TAB_VISIBILITY)
    .filter(([_, visibility]) => visibility[role] === 'visible')
    .map(([tab, _]) => tab)
}

/**
 * Check if PM can create new projects
 */
export function canCreateProject(role: UserRole | null): boolean {
  return role === 'admin'
}

/**
 * Check if role can see full project list
 */
export function canSeeFullProjectList(role: UserRole | null): boolean {
  return role === 'admin'
}

/**
 * Check if role can see projects (filtered or full)
 */
export function canSeeProjects(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager'
}

/**
 * Check if role can manage team members
 */
export function canManageTeam(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager'
}

/**
 * Check if role can see cost/financial data
 */
export function canSeeCostData(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager'
}

/**
 * Check if role can see expense details
 */
export function canSeeExpenseDetails(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager'
}

/**
 * Check if role is admin
 */
export function isAdmin(role: UserRole | null): boolean {
  return role === 'admin'
}

/**
 * Check if role is project manager or admin
 */
export function isProjectManagerOrAdmin(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager'
}
