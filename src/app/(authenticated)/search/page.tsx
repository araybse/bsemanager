'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Search, 
  Brain, 
  Lightbulb,
  Link as LinkIcon,
  Users,
  Building2,
  FileText,
  CheckCircle,
  Sparkles
} from 'lucide-react'

interface QueryResult {
  results: any[]
  confidence: number
  sources: string[]
  relatedEntities?: string[]
  relatedActions?: string[]
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<QueryResult | null>(null)

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const response = await fetch('/api/knowledge-graph/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      })
      return response.json()
    },
    onSuccess: (data) => {
      setSearchResults(data)
    }
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      searchMutation.mutate(query)
    }
  }

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'person': return <Users className="h-4 w-4" />
      case 'company': return <Building2 className="h-4 w-4" />
      case 'project': return <FileText className="h-4 w-4" />
      default: return <LinkIcon className="h-4 w-4" />
    }
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return <Badge className="bg-green-500">High Confidence ({Math.round(confidence * 100)}%)</Badge>
    }
    if (confidence >= 0.5) {
      return <Badge className="bg-yellow-500">Medium Confidence ({Math.round(confidence * 100)}%)</Badge>
    }
    return <Badge className="bg-orange-500">Low Confidence ({Math.round(confidence * 100)}%)</Badge>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 bg-primary/10 rounded-full">
            <Brain className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Search</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Ask questions in natural language and search across all your business knowledge
        </p>
      </div>

      {/* Search Bar */}
      <Card className="max-w-4xl mx-auto">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask the brain anything... (e.g., 'Who works on 25-18?' or 'What's the status of permits?')"
                className="pl-10 h-12 text-base"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={searchMutation.isPending || !query.trim()}
            >
              {searchMutation.isPending ? (
                <>Searching...</>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Search Knowledge Base
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Example Queries */}
      {!searchResults && !searchMutation.isPending && (
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Try asking...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {[
                'Who works on project 25-18?',
                'What permits are pending for Kayla\'s Landing?',
                'Show me all blocked actions',
                'Who at COJ reviews our permits?',
                'What projects is Rick Foster involved in?'
              ].map(example => (
                <button
                  key={example}
                  onClick={() => {
                    setQuery(example)
                    searchMutation.mutate(example)
                  }}
                  className="text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{example}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchMutation.isError && (
        <Alert variant="destructive" className="max-w-4xl mx-auto">
          <AlertDescription>
            Failed to execute search. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {searchResults && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Confidence Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getConfidenceBadge(searchResults.confidence)}
              <Badge variant="outline">
                {searchResults.results.length} result{searchResults.results.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Sources:</span>
              {searchResults.sources.map(source => (
                <Badge key={source} variant="secondary">{source}</Badge>
              ))}
            </div>
          </div>

          {/* Results */}
          {searchResults.results.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No results found for your query.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Try rephrasing your question or using different keywords.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {searchResults.results.map((result, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      {/* Entity/Result Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            {getEntityIcon(result.entity_type || result.type)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">
                              {result.canonical_name || result.name || result.description}
                            </h3>
                            {result.entity_type && (
                              <Badge variant="outline" className="mt-1">
                                {result.entity_type}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {result.current_status && (
                          <Badge>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {result.current_status}
                          </Badge>
                        )}
                      </div>

                      {/* Details */}
                      <div className="grid gap-2 text-sm">
                        {result.canonical_email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-medium">Email:</span>
                            <a href={`mailto:${result.canonical_email}`} className="hover:underline">
                              {result.canonical_email}
                            </a>
                          </div>
                        )}
                        {result.canonical_phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-medium">Phone:</span>
                            <span>{result.canonical_phone}</span>
                          </div>
                        )}
                        {result.canonical_company && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-medium">Company:</span>
                            <span>{result.canonical_company}</span>
                          </div>
                        )}
                        {result.due_date && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-medium">Due:</span>
                            <span>{new Date(result.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Related Info */}
                      {result.source_email_ids && result.source_email_ids.length > 0 && (
                        <div className="pt-2 border-t">
                          <div className="text-xs text-muted-foreground">
                            Source: {result.source_email_ids.length} email{result.source_email_ids.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Related Entities/Actions */}
          {(searchResults.relatedEntities?.length || searchResults.relatedActions?.length) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Related Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {searchResults.relatedEntities && searchResults.relatedEntities.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-1">Related Entities:</div>
                      <div className="flex flex-wrap gap-2">
                        {searchResults.relatedEntities.map(entityId => (
                          <Badge key={entityId} variant="outline">{entityId.slice(0, 8)}...</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {searchResults.relatedActions && searchResults.relatedActions.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-1">Related Actions:</div>
                      <div className="flex flex-wrap gap-2">
                        {searchResults.relatedActions.map(actionId => (
                          <Badge key={actionId} variant="outline">{actionId.slice(0, 8)}...</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
