'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Tables, UserRole } from '@/lib/types/database'

interface AuthContextType {
  user: User | null
  profile: Tables<'profiles'> | null
  role: UserRole | null
  assignedProjectIds: number[] // Projects where user is PM or team member
  isLoading: boolean
  isReady: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  assignedProjectIds: [],
  isLoading: true,
  isReady: false,
  signOut: async () => {},
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [assignedProjectIds, setAssignedProjectIds] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const initRef = useRef(false)
  const supabase = createClient()

  const fetchAuthState = async (retries = 2): Promise<boolean> => {
    try {
      // Fetch from server-side API route which has fresh cookies
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
      })
      
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setProfile(data.profile)
        setAssignedProjectIds(data.assignedProjectIds || [])
        console.log('[Auth] Fetch success:', data.user?.email)
        return true
      } else if (response.status === 401 && retries > 0) {
        // Session might not be ready yet, retry after a short delay
        console.log('[Auth] 401 received, retrying in 500ms...')
        await new Promise(resolve => setTimeout(resolve, 500))
        return fetchAuthState(retries - 1)
      } else {
        console.log('[Auth] Fetch failed:', response.status)
        setUser(null)
        setProfile(null)
        setAssignedProjectIds([])
        return false
      }
    } catch (error) {
      console.error('[Auth] Fetch error:', error)
      if (retries > 0) {
        console.log('[Auth] Retrying after error...')
        await new Promise(resolve => setTimeout(resolve, 500))
        return fetchAuthState(retries - 1)
      }
      setUser(null)
      setProfile(null)
      setAssignedProjectIds([])
      return false
    }
  }

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initRef.current) return
    initRef.current = true

    let mounted = true

    const initAuth = async () => {
      console.log('[Auth] Initializing...')
      
      await fetchAuthState()
      
      if (mounted) {
        console.log('[Auth] Init complete')
        setIsLoading(false)
        setIsReady(true)
      }
    }

    // Set up auth state listener for client-side events (sign in, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (!mounted) return
        
        console.log('[Auth] State change:', event)
        
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setIsReady(true)
          return
        }
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Re-fetch from server to get fresh state
          await fetchAuthState()
        }
        
        setIsLoading(false)
        setIsReady(true)
      }
    )

    // Initialize
    initAuth()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = async () => {
    setIsLoading(true)
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setAssignedProjectIds([])
    setIsLoading(false)
  }

  const refresh = async () => {
    await fetchAuthState()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        assignedProjectIds,
        isLoading,
        isReady,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
