'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import type { Tables, UserRole } from '@/lib/types/database'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Tables<'profiles'> | null
  role: UserRole | null
  isLoading: boolean
  isReady: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  isLoading: true,
  isReady: false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
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

    const initAuth = async () => {
      try {
        // Get the initial session - this reads from localStorage
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        if (initialSession) {
          setSession(initialSession)
          setUser(initialSession.user)
          
          // Fetch profile
          const profileData = await fetchProfile(initialSession.user.id)
          if (mounted) setProfile(profileData)
        }
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        if (mounted) {
          setIsLoading(false)
          setIsReady(true)
        }
      }
    }

    // Listen for auth state changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return
        
        console.log('Auth event:', event)
        
        setSession(newSession)
        setUser(newSession?.user ?? null)
        
        if (newSession?.user) {
          const profileData = await fetchProfile(newSession.user.id)
          if (mounted) setProfile(profileData)
        } else {
          setProfile(null)
        }
        
        setIsLoading(false)
        setIsReady(true)
      }
    )

    // Then initialize
    initAuth()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signOut = async () => {
    setIsLoading(true)
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    setIsLoading(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role: profile?.role ?? null,
        isLoading,
        isReady,
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
