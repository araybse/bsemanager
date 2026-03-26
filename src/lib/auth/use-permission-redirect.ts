'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface PermissionCheckOptions {
  allowedRoles: string[]
  redirectTo?: string
}

/**
 * Hook to check user permissions and redirect if not allowed
 * @param allowedRoles - Array of roles that are allowed to view this page
 * @param redirectTo - Where to redirect if not allowed (default: '/timesheet')
 */
export function usePermissionRedirect(options: PermissionCheckOptions) {
  const { allowedRoles, redirectTo = '/timesheet' } = options
  const supabase = createClient()
  const router = useRouter()

  const { data: userRole, isLoading } = useQuery({
    queryKey: ['user-role-permission-check'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      return (profile as { role: string } | null)?.role || null
    },
  })

  useEffect(() => {
    if (!isLoading && userRole && !allowedRoles.includes(userRole)) {
      router.replace(redirectTo)
    }
  }, [userRole, isLoading, allowedRoles, redirectTo, router])

  return { userRole, isLoading }
}
