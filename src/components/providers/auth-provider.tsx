'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Tables, UserRole } from '@/lib/types/database'

interface AuthContextType {
  user: User | null
  profile: Tables<'profiles'> | null
  role: UserRole | null
  isLoading: boolean
  isReady: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  isLoading: true,
  isReady: false,
  signOut: async () => {},
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const initRef = useRef(false)
  const supabase = createClient()

  const fetchAuthState = async () => {
    try {
      // Fetch from server-side API route which has fresh cookies
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setProfile(data.profile)
        return true
      } else {
        setUser(null)
        setProfile(null)
        return false
      }
    } catch (error) {
      console.error('[Auth] Fetch error:', error)
      setUser(null)
      setProfile(null)
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
