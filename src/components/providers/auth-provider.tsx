'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Tables, UserRole } from '@/lib/types/database'

interface AuthContextType {
  user: User | null
  profile: Tables<'profiles'> | null
  role: UserRole | null
  isLoading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  isLoading: true,
  signOut: async () => {},
  refreshSession: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }
      return data
    } catch (err) {
      console.error('Error fetching profile:', err)
      return null
    }
  }, [supabase])

  const refreshSession = useCallback(async () => {
    try {
      // Use getUser() instead of getSession() - this validates with the server
      const { data: { user: currentUser }, error } = await supabase.auth.getUser()
      
      if (error || !currentUser) {
        // Session is invalid, clear state
        setUser(null)
        setProfile(null)
        return
      }

      setUser(currentUser)
      const profileData = await fetchProfile(currentUser.id)
      setProfile(profileData)
    } catch (err) {
      console.error('Error refreshing session:', err)
      setUser(null)
      setProfile(null)
    }
  }, [supabase, fetchProfile])

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // First, try to get the user (validates with server)
        const { data: { user: currentUser }, error } = await supabase.auth.getUser()
        
        if (!mounted) return

        if (error) {
          // If there's an auth error, try refreshing the session
          const { data: { session } } = await supabase.auth.refreshSession()
          
          if (!mounted) return
          
          if (session?.user) {
            setUser(session.user)
            const profileData = await fetchProfile(session.user.id)
            if (mounted) setProfile(profileData)
          } else {
            setUser(null)
            setProfile(null)
          }
        } else if (currentUser) {
          setUser(currentUser)
          const profileData = await fetchProfile(currentUser.id)
          if (mounted) setProfile(profileData)
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
        if (mounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        
        console.log('Auth state change:', event)
        
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setIsLoading(false)
          return
        }

        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          if (session?.user) {
            setUser(session.user)
            const profileData = await fetchProfile(session.user.id)
            if (mounted) setProfile(profileData)
          }
        }

        if (event === 'INITIAL_SESSION') {
          // Initial session is handled by initializeAuth
          return
        }

        setIsLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        isLoading,
        signOut,
        refreshSession,
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
