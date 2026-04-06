'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tantml:parameter>
<parameter name="content">import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Ban, 
  PlayCircle,
  Search,
  Calendar,
  User
} from 'lucide-react'
import type { ActionStatus } from '@/lib/phase2/action-state-machine'

interface Action {
  id: string
  actionType: string
  description: string
  currentStatus: ActionStatus
  dueDate?: string
  ownerEntityId?: string
  assigneeEntityId?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  tags: string[]
  createdAt: string
}

const STATUS_TABS = [
  { value: 'all', label: 'All', icon: null },
  { value: 'pending', label: 'Pending', icon: Clock },
  { value: 'in_progress', label: 'In Progress', icon: PlayCircle },
  { value: 'blocked', label: 'Blocked', icon: Ban },
  { value: 'completed', label: 'Completed', icon: CheckCircle2 },
  { value: 'overdue', label: 'Overdue', icon: AlertCircle },
] as const

export default function ActionsPage() {
  const [activeStatus, setActiveStatus] = useState<ActionStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'status'>('date')
  const queryClient = useQueryClient()

  // Fetch actions
  const { data: actionsData, isLoading } = useQuery({
    queryKey: ['actions', activeStatus],
    queryFn: async () => {
      const url = activeStatus === 'all' 
        ? '/api/admin/actions'
        : `/api/admin/actions?status=${activeStatus}`
      const response = await fetch(url)
      const json = await response.json()
      return json.data as Action[]
    }
  })

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ actionId, newStatus }: { actionId: string; newStatus: ActionStatus }) => {
      const response = await fetch(`/api/admin/actions/${actionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus, changedBy: 'admin' })
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] })
    }
  })

  const getStatusIcon = (status: ActionStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'in_progress': return <PlayCircle className="h-4 w-4 text-blue-500" />
      case 'blocked': return <Ban className="h-4 w-4 text-red-500" />
      case 'overdue': return <AlertCircle className="h-4 w-4 text-orange-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getDaysUntilDue = (dueDate?: string) => {
    if (!dueDate) return null
    const days = Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  // Filter and sort actions
  const filteredActions = (actionsData || [])
    .filter(action => 
      searchQuery === '' || 
      action.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      action.actionType.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      if (sortBy === 'priority') {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        return (priorityOrder[b.priority || 'low'] || 0) - (priorityOrder[a.priority || 'low'] || 0)
      }
      return 0
    })

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Action Tracking</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage action items across all projects
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {actionsData?.filter(a => a.currentStatus === 'pending').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <PlayCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {actionsData?.filter(a => a.currentStatus === 'in_progress').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {actionsData?.filter(a => a.currentStatus === 'blocked').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {actionsData?.filter(a => a.currentStatus === 'overdue').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Actions List with Tabs */}
      <Tabs value={activeStatus} onValueChange={(val) => setActiveStatus(val as any)}>
        <TabsList className="grid w-full grid-cols-6">
          {STATUS_TABS.map(tab => {
            const Icon = tab.icon
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                {Icon && <Icon className="h-4 w-4" />}
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value={activeStatus} className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredActions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No actions found
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredActions.map(action => {
                    const daysUntilDue = getDaysUntilDue(action.dueDate)
                    
                    return (
                      <div
                        key={action.id}
                        className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(action.currentStatus)}
                              <h3 className="font-semibold">{action.description}</h3>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <Badge variant="outline">{action.actionType}</Badge>
                              
                              {action.priority && (
                                <Badge className={getPriorityColor(action.priority)}>
                                  {action.priority}
                                </Badge>
                              )}
                              
                              {action.dueDate && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {new Date(action.dueDate).toLocaleDateString()}
                                    {daysUntilDue !== null && (
                                      <span className={daysUntilDue < 0 ? 'text-red-500 ml-1' : 'ml-1'}>
                                        ({daysUntilDue > 0 ? `${daysUntilDue}d left` : `${Math.abs(daysUntilDue)}d overdue`})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                              
                              {action.tags.map(tag => (
                                <Badge key={tag} variant="secondary">{tag}</Badge>
                              ))}
                            </div>
                          </div>

                          <Select
                            value={action.currentStatus}
                            onValueChange={(newStatus) => 
                              updateStatusMutation.mutate({ 
                                actionId: action.id, 
                                newStatus: newStatus as ActionStatus 
                              })
                            }
                            disabled={updateStatusMutation.isPending}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="blocked">Blocked</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
