import { requireApiRoles } from '@/lib/auth/api-authorization'

export async function requireCamAccess() {
  return requireApiRoles(['admin', 'project_manager'])
}
