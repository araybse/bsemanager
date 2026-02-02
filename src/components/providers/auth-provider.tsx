'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, AuthError } from '@supabase/supabase-js'
import type { Tables, UserRole } from '@/lib/types/database'

interface AuthContextType {
  user: User | null
  profile: Tables<'profiles'> | null
  role: UserRole | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  isLoading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

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

  useEffect(() => {
    let mounted = true
    let retryCount = 0
    const maxRetries = 3

    const initializeAuth = async () => {
      try {
        // First try to get the session (reads from storage)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (session?.user) {
          // Session exists, validate it with getUser
          const { data: { user: validatedUser }, error: userError } = await supabase.auth.getUser()
          
          if (!mounted) return
          
          if (userError) {
            console.log('Session validation failed, attempting refresh...')
            // Try to refresh the session
            const { data: { session: refreshedSession } } = await supabase.auth.refreshSession()
            
            if (!mounted) return
            
            if (refreshedSession?.user) {
              setUser(refreshedSession.user)
              const profileData = await fetchProfile(refreshedSession.user.id)
              if (mounted) setProfile(profileData)
            } else {
              // Refresh failed, clear auth state
              setUser(null)
              setProfile(null)
            }
          } else if (validatedUser) {
            setUser(validatedUser)
            const profileData = await fetchProfile(validatedUser.id)
            if (mounted) setProfile(profileData)
          }
        } else {
          // No session
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
        
        // Retry on error
        if (retryCount < maxRetries && mounted) {
          retryCount++
          console.log(`Retrying auth init (${retryCount}/${maxRetries})...`)
          setTimeout(initializeAuth, 1000 * retryCount)
          return
        }
        
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
          return
        }

        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          if (session?.user) {
            setUser(session.user)
            const profileData = await fetchProfile(session.user.id)
            if (mounted) setProfile(profileData)
          }
        }
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
