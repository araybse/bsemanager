'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, RefreshCw, Users, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import type { Tables } from '@/lib/types/database'

type QBSettings = {
  id: number
  access_token: string
  refresh_token: string
  realm_id: string
  token_expires_at: string
  connected_at: string
  updated_at: string
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function SettingsContent() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [isSyncing, setIsSyncing] = useState(false)

  // Show toast messages based on URL params
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    
    if (success === 'connected') {
      toast.success('QuickBooks Time connected successfully!')
    } else if (error) {
      const errorMessages: Record<string, string> = {
        no_code: 'Authorization failed - no code received',
        token_exchange_failed: 'Failed to exchange authorization code',
        storage_failed: 'Failed to save connection settings',
        unknown: 'An unknown error occurred',
      }
      toast.error(errorMessages[error] || `Connection error: ${error}`)
    }
  }, [searchParams])

  const { data: users, isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')
      if (error) throw error
      return data as Tables<'profiles'>[]
    },
  })

  // Check QB connection status
  const { data: qbSettings, isLoading: loadingQB } = useQuery({
    queryKey: ['qb-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qb_settings')
        .select('*')
        .maybeSingle()
      if (error) {
        console.error('QB settings error:', error)
        return null
      }
      return data as QBSettings | null
    },
  })

  const handleConnect = () => {
    // Build OAuth URL directly
    const clientId = 'ABNwS1wdlFZUksK4cvygv7UTcExBlNPnRTf1cszsRR9uaLSukX'
    const redirectUri = encodeURIComponent('http://localhost:3000/api/qb-time/callback')
    const state = Math.random().toString(36).substring(7)
    
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&response_type=code&scope=com.intuit.quickbooks.accounting&redirect_uri=${redirectUri}&state=${state}`
    
    // Navigate directly (same tab)
    window.location.href = authUrl
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect QuickBooks Time?')) return
    
    const { error } = await supabase
      .from('qb_settings')
      .delete()
      .neq('id', 0)
    
    if (error) {
      toast.error('Failed to disconnect')
    } else {
      toast.success('QuickBooks Time disconnected')
      queryClient.invalidateQueries({ queryKey: ['qb-settings'] })
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/qb-time/sync', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(data.message)
        queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      } else {
        toast.error(data.error || 'Sync failed')
      }
    } catch (error) {
      toast.error('Failed to sync time entries')
    } finally {
      setIsSyncing(false)
    }
  }

  const isConnected = !!qbSettings?.access_token
  const connectionDate = qbSettings?.connected_at 
    ? new Date(qbSettings.connected_at).toLocaleDateString()
    : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage users and integrations
        </p>
      </div>

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>User Management</CardTitle>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>
          <CardDescription>
            Manage user accounts and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.title || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'outline' : 'destructive'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* QuickBooks Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            <CardTitle>QuickBooks Time Integration</CardTitle>
          </div>
          <CardDescription>
            Sync time entries from QuickBooks Time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingQB ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                {isConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <div className="font-medium">QuickBooks Time</div>
                  <div className="text-sm text-muted-foreground">
                    {isConnected 
                      ? `Connected on ${connectionDate}`
                      : 'Not connected'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {isConnected ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={handleSync}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync Now
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" onClick={handleDisconnect}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleConnect}>
                    Connect QuickBooks
                  </Button>
                )}
              </div>
            </div>
          )}
          
          <div className="text-sm text-muted-foreground">
            {isConnected ? (
              <p>
                Click "Sync Now" to import the latest time entries from QuickBooks Time.
                Entries will be matched to projects based on job codes.
              </p>
            ) : (
              <p>
                Connect your QuickBooks Time account to import time entries automatically.
                You'll be redirected to Intuit to authorize the connection.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
