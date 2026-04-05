'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabsContent, Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

type AgencyCatalogRow = {
  id: number
  code: string
  name: string
  is_active: boolean
  sort_order: number
}

type PermitCatalogRow = {
  id: number
  agency_id: number
  code: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
}

type PermitRequiredItemCatalogRow = {
  id: number
  permit_id: number
  code: string
  name: string
  item_type: 'application' | 'document' | 'plan' | 'other'
  responsibility: 'internal' | 'provided' | 'shared'
  default_required: boolean
  application_template_id: number | null
  sort_order: number
}

type ProjectRequiredItemRow = {
  id: number
  project_id: number
  project_permit_selection_id: number
  required_item_catalog_id: number | null
  code: string | null
  name: string
  item_type: 'application' | 'document' | 'plan' | 'other'
  responsibility: 'internal' | 'provided' | 'shared'
  is_required: boolean
  status: string
  source_url: string | null
  output_file_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type ApplicationTemplateRow = {
  id: number
  agency_id: number
  permit_id: number | null
  code: string
  name: string
  storage_path: string | null
  is_active: boolean
}

type ApplicationsTabProps = {
  projectId: number | null
  applicationsByAgency: Array<{ agency: AgencyCatalogRow; items: ProjectRequiredItemRow[] }>
  permitSelectionsById: Map<number, any>
  permitById: Map<number, PermitCatalogRow>
  requiredCatalogById: Map<number, PermitRequiredItemCatalogRow>
  templateById: Map<number, ApplicationTemplateRow>
}

export function ApplicationsTab({
  projectId,
  applicationsByAgency,
  permitSelectionsById,
  permitById,
  requiredCatalogById,
  templateById,
}: ApplicationsTabProps) {
  const queryClient = useQueryClient()
  const [generatingRequiredItemId, setGeneratingRequiredItemId] = useState<number | null>(null)

  const generateApplication = async (requiredItemId: number) => {
    setGeneratingRequiredItemId(requiredItemId)
    try {
      const response = await fetch(`/api/projects/${projectId}/applications/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requiredItemId }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to generate application')
      }
      const downloadUrl = String(payload.downloadUrl || '')
      const suggestedFileName = String(payload.fileName || `application-${requiredItemId}.pdf`)
      if (downloadUrl) {
        const pdfResponse = await fetch(downloadUrl)
        if (!pdfResponse.ok) {
          throw new Error('Application generated but failed to download PDF')
        }
        const pdfBlob = await pdfResponse.blob()
        const downloadBlobFallback = (blob: Blob, filename: string) => {
          const objectUrl = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = objectUrl
          link.download = filename
          document.body.appendChild(link)
          link.click()
          link.remove()
          URL.revokeObjectURL(objectUrl)
        }

        const pickerHost = window as unknown as {
          showSaveFilePicker?: (options?: {
            suggestedName?: string
            types?: Array<{ description?: string; accept?: Record<string, string[]> }>
          }) => Promise<{
            createWritable: () => Promise<{
              write: (data: Blob) => Promise<void>
              close: () => Promise<void>
            }>
          }>
        }

        if (typeof pickerHost.showSaveFilePicker === 'function') {
          try {
            const handle = await pickerHost.showSaveFilePicker({
              suggestedName: suggestedFileName,
              types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }],
            })
            const writable = await handle.createWritable()
            await writable.write(pdfBlob)
            await writable.close()
          } catch (pickerError) {
            if (
              pickerError instanceof DOMException &&
              (pickerError.name === 'AbortError' || pickerError.name === 'NotAllowedError')
            ) {
              downloadBlobFallback(pdfBlob, suggestedFileName)
            } else {
              throw pickerError
            }
          }
        } else {
          downloadBlobFallback(pdfBlob, suggestedFileName)
        }
      }

      toast.success('Application generated and saved')
      queryClient.invalidateQueries({ queryKey: ['project-required-items', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-application-runs', projectId] })
    } catch (error) {
      toast.error((error as Error).message || 'Failed to generate application')
    } finally {
      setGeneratingRequiredItemId(null)
    }
  }

  return (
    <TabsContent value="applications" className="mt-4">
      {applicationsByAgency.length > 0 ? (
        <Tabs defaultValue={`agency-${applicationsByAgency[0].agency.id}`} className="w-full">
          <TabsList className="mb-4">
            {applicationsByAgency.map(({ agency }) => (
              <TabsTrigger key={`app-agency-${agency.id}`} value={`agency-${agency.id}`}>
                {agency.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {applicationsByAgency.map(({ agency, items }) => (
            <TabsContent key={`app-content-${agency.id}`} value={`agency-${agency.id}`} className="mt-0">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>{agency.name} Applications</CardTitle>
                  <CardDescription>
                    Generates downloadable application PDFs from mapped project data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Application Item</TableHead>
                        <TableHead>Permit</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const selection = permitSelectionsById.get(item.project_permit_selection_id)
                        const permit = selection ? permitById.get(selection.permit_id) : null
                        const requiredCatalog = item.required_item_catalog_id
                          ? requiredCatalogById.get(item.required_item_catalog_id)
                          : null
                        const template = requiredCatalog?.application_template_id
                          ? templateById.get(requiredCatalog.application_template_id)
                          : null
                        return (
                          <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{permit?.name || 'Unknown Permit'}</TableCell>
                            <TableCell>
                              {template ? (
                                <div>
                                  <div className="font-medium">{template.name}</div>
                                  <div className="text-xs text-muted-foreground">{template.code}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No template</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.status === 'generated' ? 'default' : 'secondary'}>
                                {item.status.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={generatingRequiredItemId === item.id || !template}
                                  onClick={() => void generateApplication(item.id)}
                                >
                                  {generatingRequiredItemId === item.id ? 'Generating...' : 'Generate'}
                                </Button>
                                {item.output_file_url ? (
                                  <Button asChild size="sm">
                                    <a href={item.output_file_url} target="_blank" rel="noreferrer">
                                      Download
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                            No application-type required items for this agency.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card>
          <CardContent className="p-4 text-center text-muted-foreground">
            No application-type required items are selected yet.
          </CardContent>
        </Card>
      )}
    </TabsContent>
  )
}
