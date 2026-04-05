'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

type ProjectOption = { id: number; project_number: string; project_name: string | null }
type UtilityLetter = {
  id: number
  letter_type: 'pressure_connection' | 'hydrant_flow'
  issuer_name: string | null
  letter_date: string | null
  reference_number: string | null
  values: Record<string, unknown>
  entered_at: string
}

export function CamUtilitiesInputsSection() {
  const supabase = createClient()
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [letterType, setLetterType] = useState<'pressure_connection' | 'hydrant_flow'>(
    'pressure_connection'
  )
  const [issuerName, setIssuerName] = useState('')
  const [letterDate, setLetterDate] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [valuesText, setValuesText] = useState('{\n  "note": "Enter structured values here"\n}')
  const [letters, setLetters] = useState<UtilityLetter[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    
    async function bootstrap() {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_number, project_name')
        .order('project_number')
        .limit(500)
      if (cancelled) return
      if (error) {
        toast.error(error.message)
        return
      }
      const rows = (data || []) as ProjectOption[]
      setProjects(rows)
      if (rows.length > 0) {
        setProjectId(String(rows[0].id))
      }
    }
    void bootstrap()
    
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    
    async function loadLetters() {
      if (!projectId) return
      const response = await fetch(`/api/cam/utilities/letters?projectId=${projectId}`, {
        method: 'GET',
      })
      if (cancelled) return
      const json = await response.json()
      if (cancelled) return
      if (!response.ok) {
        toast.error(json.error || 'Failed to load letters')
        return
      }
      setLetters(json.letters || [])
    }
    void loadLetters()
    
    return () => {
      cancelled = true
    }
  }, [projectId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!projectId) {
      toast.error('Select a project first')
      return
    }

    setIsSaving(true)
    try {
      let parsedValues: Record<string, unknown> = {}
      try {
        parsedValues = JSON.parse(valuesText) as Record<string, unknown>
      } catch {
        toast.error('Values must be valid JSON')
        return
      }

      const response = await fetch('/api/cam/utilities/letters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: Number(projectId),
          letterType,
          issuerName,
          letterDate: letterDate || undefined,
          referenceNumber: referenceNumber || undefined,
          values: parsedValues,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        toast.error(json.error || 'Failed to save letter')
        return
      }

      toast.success('Letter saved')
      setLetters((prev) => [json.letter, ...prev])
      setReferenceNumber('')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Utilities External Inputs</CardTitle>
          <CardDescription>
            Portal forms for pressure connection and hydrant flow letters feeding the utilities engine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.project_number} - {project.project_name || 'Untitled'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Letter Type</Label>
              <Select value={letterType} onValueChange={(value) => setLetterType(value as typeof letterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pressure_connection">Pressure Connection</SelectItem>
                  <SelectItem value="hydrant_flow">Hydrant Flow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Issuer Name</Label>
              <Input value={issuerName} onChange={(e) => setIssuerName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Letter Date</Label>
              <Input type="date" value={letterDate} onChange={(e) => setLetterDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Structured Values (JSON)</Label>
              <textarea
                className="min-h-40 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={valuesText}
                onChange={(e) => setValuesText(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Letter'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Letter Inputs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {letters.map((letter) => (
              <div key={letter.id} className="rounded border p-3 text-sm">
                <div className="font-medium">
                  {letter.letter_type} - {letter.reference_number || 'No reference'}
                </div>
                <div className="text-muted-foreground">
                  {letter.issuer_name || 'Unknown issuer'} | {letter.letter_date || 'No date'}
                </div>
              </div>
            ))}
            {letters.length === 0 ? <div className="text-sm text-muted-foreground">No letters yet.</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
