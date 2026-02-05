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

type SyncSummary = {
  imported: number
  updated: number
  total: number
}

type TimeSyncSummary = {
  imported: number
  skipped: number
  total: number
}

type SyncResults = {
  customers?: SyncSummary
  projects?: SyncSummary
  invoices?: SyncSummary
  timeEntries?: TimeSyncSummary
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
  const [syncType, setSyncType] = useState<'all' | 'customers' | 'projects' | 'invoices' | 'time'>('all')
  const [lastSyncResults, setLastSyncResults] = useState<SyncResults | null>(null)

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
    // Use the API route to handle OAuth (it has access to server env vars)
    window.location.href = '/api/qb-time/auth'
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

  const handleSync = async (type: 'all' | 'customers' | 'projects' | 'invoices' | 'time' = 'all') => {
    setIsSyncing(true)
    setSyncType(type)
    setLastSyncResults(null)
    try {
      const response = await fetch('/api/qb-time/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(data.message)
        setLastSyncResults(data.results)
        queryClient.invalidateQueries({ queryKey: ['time-entries'] })
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
        queryClient.invalidateQueries({ queryKey: ['clients'] })
        queryClient.invalidateQueries({ queryKey: ['projects'] })
      } else {
        toast.error(data.error || 'Sync failed')
      }
    } catch (error) {
      toast.error('Failed to sync')
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
            <CardTitle>QuickBooks Online Integration</CardTitle>
          </div>
          <CardDescription>
            Sync customers, projects, invoices, and time entries from QuickBooks Online
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
                  <div className="font-medium">QuickBooks Online</div>
                  <div className="text-sm text-muted-foreground">
                    {isConnected 
                      ? `Connected on ${connectionDate}`
                      : 'Not connected'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {isConnected ? (
                  <Button variant="ghost" onClick={handleDisconnect}>
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={handleConnect}>
                    Connect QuickBooks
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {isConnected && (
            <div className="space-y-4">
              <div className="text-sm font-medium">Sync Options</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('all')}
                  disabled={isSyncing}
                  className="h-auto py-3"
                >
                  {isSyncing && syncType === 'all' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  <div className="text-left">
                    <div className="font-medium">Sync All</div>
                    <div className="text-xs text-muted-foreground">Everything</div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('customers')}
                  disabled={isSyncing}
                  className="h-auto py-3"
                >
                  {isSyncing && syncType === 'customers' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="mr-2 h-4 w-4" />
                  )}
                  <div className="text-left">
                    <div className="font-medium">Customers</div>
                    <div className="text-xs text-muted-foreground">Clients</div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('projects')}
                  disabled={isSyncing}
                  className="h-auto py-3"
                >
                  {isSyncing && syncType === 'projects' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  )}
                  <div className="text-left">
                    <div className="font-medium">Projects</div>
                    <div className="text-xs text-muted-foreground">Jobs</div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('invoices')}
                  disabled={isSyncing}
                  className="h-auto py-3"
                >
                  {isSyncing && syncType === 'invoices' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  <div className="text-left">
                    <div className="font-medium">Invoices</div>
                    <div className="text-xs text-muted-foreground">Bills sent</div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('time')}
                  disabled={isSyncing}
                  className="h-auto py-3"
                >
                  {isSyncing && syncType === 'time' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <div className="text-left">
                    <div className="font-medium">Time</div>
                    <div className="text-xs text-muted-foreground">Time entries</div>
                  </div>
                </Button>
              </div>
              
              {lastSyncResults && (
                <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
                  <div className="text-sm font-medium">Last Sync Results</div>
                  {lastSyncResults.customers && (
                    <div className="text-sm">
                      <span className="font-medium">Customers:</span>{' '}
                      {lastSyncResults.customers.imported} imported,{' '}
                      {lastSyncResults.customers.updated} updated{' '}
                      (of {lastSyncResults.customers.total} total)
                    </div>
                  )}
                  {lastSyncResults.projects && (
                    <div className="text-sm">
                      <span className="font-medium">Projects:</span>{' '}
                      {lastSyncResults.projects.imported} imported,{' '}
                      {lastSyncResults.projects.updated} updated{' '}
                      (of {lastSyncResults.projects.total} total)
                    </div>
                  )}
                  {lastSyncResults.invoices && (
                    <div className="text-sm">
                      <span className="font-medium">Invoices:</span>{' '}
                      {lastSyncResults.invoices.imported} imported,{' '}
                      {lastSyncResults.invoices.updated} updated{' '}
                      (of {lastSyncResults.invoices.total} total)
                    </div>
                  )}
                  {lastSyncResults.timeEntries && (
                    <div className="text-sm">
                      <span className="font-medium">Time Entries:</span>{' '}
                      {lastSyncResults.timeEntries.imported} imported,{' '}
                      {lastSyncResults.timeEntries.skipped} skipped{' '}
                      (of {lastSyncResults.timeEntries.total} total)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="text-sm text-muted-foreground">
            {isConnected ? (
              <p>
                Select a sync option above to import data from QuickBooks Online.
                Projects are synced from QBO sub-customers (jobs). Data will be matched to existing records by ID or name.
              </p>
            ) : (
              <p>
                Connect your QuickBooks Online account to sync customers, projects, invoices, and time entries.
                You'll be redirected to Intuit to authorize the connection.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
