'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Users, 
  Building2, 
  Mail, 
  Phone,
  AlertTriangle 
} from 'lucide-react'

interface MatchCandidate {
  id: string
  entityAId: string
  entityBId: string
  matchScore: number
  matchReasons: {
    nameSimilarity?: number
    emailMatch?: boolean
    phoneMatch?: boolean
    companySimilarity?: number
  }
  status: string
  createdAt: string
  entityAData?: any
  entityBData?: any
}

export default function EntityReviewPage() {
  const [selectedMatch, setSelectedMatch] = useState<MatchCandidate | null>(null)
  const queryClient = useQueryClient()

  // Fetch pending reviews
  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['entity-reviews'],
    queryFn: async () => {
      const response = await fetch('/api/admin/entity-review/queue')
      const json = await response.json()
      return json.data as MatchCandidate[]
    },
    refetchInterval: 30000 // Refresh every 30s
  })

  // Merge mutation
  const mergeMutation = useMutation({
    mutationFn: async ({ entityId1, entityId2 }: { entityId1: string; entityId2: string }) => {
      const response = await fetch('/api/admin/entity-review/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId1, entityId2, mergedBy: 'admin' })
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-reviews'] })
      setSelectedMatch(null)
    }
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const response = await fetch('/api/admin/entity-review/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, reason: 'Manual review - not a match' })
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-reviews'] })
      setSelectedMatch(null)
    }
  })

  const handleMerge = (match: MatchCandidate) => {
    if (confirm('Are you sure you want to merge these entities? This action cannot be undone.')) {
      mergeMutation.mutate({ entityId1: match.entityAId, entityId2: match.entityBId })
    }
  }

  const handleReject = (match: MatchCandidate) => {
    rejectMutation.mutate(match.id)
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 0.9) return 'bg-green-500'
    if (score >= 0.75) return 'bg-yellow-500'
    return 'bg-orange-500'
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    )
  }

  const reviews = reviewsData || []

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Entity Merge Review</h1>
        <p className="text-muted-foreground mt-2">
          Review and resolve potential entity duplicates
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviews.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">High Confidence</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reviews.filter(r => r.matchScore >= 0.9).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reviews.filter(r => r.matchScore < 0.9).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Review Queue</CardTitle>
          <CardDescription>
            Matches sorted by confidence score (highest first)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                No pending entity merges! All duplicates have been reviewed.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {reviews.map((match) => (
                <div
                  key={match.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge className={getScoreBadgeColor(match.matchScore)}>
                        {(match.matchScore * 100).toFixed(0)}% Match
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(match.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleMerge(match)}
                        disabled={mergeMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Merge
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(match)}
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Keep Separate
                      </Button>
                    </div>
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <EntityCard entity={match.entityAData} label="Entity A" />
                    <EntityCard entity={match.entityBData} label="Entity B" />
                  </div>

                  {/* Match reasons */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm font-medium mb-2">Match Reasons:</div>
                    <div className="flex flex-wrap gap-2">
                      {match.matchReasons.nameSimilarity !== undefined && (
                        <Badge variant="outline">
                          Name: {(match.matchReasons.nameSimilarity * 100).toFixed(0)}% similar
                        </Badge>
                      )}
                      {match.matchReasons.emailMatch && (
                        <Badge variant="outline">
                          <Mail className="h-3 w-3 mr-1" />
                          Same email
                        </Badge>
                      )}
                      {match.matchReasons.phoneMatch && (
                        <Badge variant="outline">
                          <Phone className="h-3 w-3 mr-1" />
                          Same phone
                        </Badge>
                      )}
                      {match.matchReasons.companySimilarity !== undefined && match.matchReasons.companySimilarity > 0.7 && (
                        <Badge variant="outline">
                          <Building2 className="h-3 w-3 mr-1" />
                          Similar company
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EntityCard({ entity, label }: { entity: any; label: string }) {
  if (!entity) {
    return (
      <div className="p-4 border rounded-lg bg-muted/50">
        <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
        <div className="text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg">
      <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
      <div className="space-y-2">
        <div>
          <div className="text-lg font-semibold">{entity.canonical_name || entity.name}</div>
          <Badge variant="secondary" className="mt-1">
            {entity.entity_type}
          </Badge>
        </div>
        {entity.canonical_email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-3 w-3 text-muted-foreground" />
            {entity.canonical_email}
          </div>
        )}
        {entity.canonical_phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            {entity.canonical_phone}
          </div>
        )}
        {entity.canonical_company && (
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            {entity.canonical_company}
          </div>
        )}
      </div>
    </div>
  )
}
