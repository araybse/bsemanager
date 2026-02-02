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
  const [supabase] = useState(() => createClient())

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.error('Profile fetch error:', error)
        return null
      }
      return data
    } catch (err) {
      console.error('Profile fetch exception:', err)
      return null
    }
  }, [supabase])

  useEffect(() => {
    let mounted = true

    // Initialize auth state
    const init = async () => {
      console.log('Auth init starting...')
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('Session result:', session ? 'has session' : 'no session', error ? error.message : '')
        
        if (mounted && session?.user) {
          setUser(session.user)
          const profileData = await fetchProfile(session.user.id)
          if (mounted) setProfile(profileData)
        }
      } catch (error) {
        console.error('Auth init error:', error)
      }
      
      // Always set loading to false
      if (mounted) {
        console.log('Setting isLoading to false')
        setIsLoading(false)
      }
    }

    init()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session ? 'has session' : 'no session')
        
        if (!mounted) return

        try {
          if (session?.user) {
            setUser(session.user)
            const profileData = await fetchProfile(session.user.id)
            if (mounted) setProfile(profileData)
          } else {
            setUser(null)
            setProfile(null)
          }
        } catch (err) {
          console.error('Auth change handler error:', err)
        }
        
        // Always set loading to false after auth change
        if (mounted) setIsLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signOut = async () => {
    setIsLoading(true)
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setIsLoading(false)
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
