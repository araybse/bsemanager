'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { Tables } from '@/lib/types/database'

type ProjectWithRelations = Tables<'projects'> & {
  clients: { name: string } | null
  profiles: { full_name: string } | null
}

export default function ProjectsPage() {
  const supabase = createClient()

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          clients (name),
          profiles (full_name)
        `)
        .order('project_number', { ascending: false })
      if (error) throw error
      return data as ProjectWithRelations[]
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">All Projects</h2>
          <p className="text-sm text-muted-foreground">
            Manage your engineering projects
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Project
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="divide-y">
              {projects?.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{project.project_number}</span>
                      <span className="text-muted-foreground">—</span>
                      <span className="font-medium">{project.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{(project.clients as { name: string } | null)?.name || 'No client'}</span>
                      <span>•</span>
                      <span>PM: {(project.profiles as { full_name: string } | null)?.full_name || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/projects/${project.id}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
              {projects?.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No projects found. Create your first project to get started.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
