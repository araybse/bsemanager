'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Only redirect if we're done loading AND there's no user
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  // Don't block on loading - let the pages handle their own loading states
  // The middleware already protects routes, so if we're here we should be authenticated
  
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
