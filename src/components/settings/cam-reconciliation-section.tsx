'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type ProjectOption = { id: number; project_number: string; project_name: string | null }
type Summary = {
  state: 'healthy' | 'warning'
  pendingPublishCount: number
  unresolvedConflictCount: number
  staleFieldCount: number
  staleByTimeCount: number
}

export function CamReconciliationSection() {
  const supabase = createClient()
  const [projectId, setProjectId] = useState<string>('0')

  const { data: projects = [] } = useQuery({
    queryKey: ['cam-project-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_number, project_name')
        .order('project_number')
        .limit(500)
      if (error) {
        throw error
      }
      return (data || []) as ProjectOption[]
    },
  })

  const summaryUrl = useMemo(
    () => `/api/cam/reconciliation/summary${projectId !== '0' ? `?projectId=${projectId}` : ''}`,
    [projectId]
  )

  const { data: summary, refetch } = useQuery({
    queryKey: ['cam-reconciliation-summary', projectId],
    queryFn: async () => {
      const response = await fetch(summaryUrl)
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || 'Failed to load CAM reconciliation summary')
      }
      return json as Summary
    },
  })

  async function runValidation() {
    const response = await fetch('/api/cam/reconciliation/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(projectId !== '0' ? { projectId: Number(projectId) } : {}),
    })
    const json = await response.json()
    if (!response.ok) {
      toast.error(json.error || 'Validation failed')
      return
    }
    toast.success(`Validation complete: ${json.status}`)
    await refetch()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CAM Reconciliation</CardTitle>
          <CardDescription>Completeness, freshness, and drift monitoring for CAM domains.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="w-full max-w-sm">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.project_number} - {project.project_name || 'Untitled'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={runValidation}>Run Validation</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">State</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.state || 'unknown'}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending CAD Publish</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary?.pendingPublishCount ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Unresolved Crossings</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary?.unresolvedConflictCount ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stale Fields</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.staleFieldCount ?? 0}</CardContent>
        </Card>
      </div>
    </div>
  )
}
