'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils/dates'

type Profile = {
  id: string
  full_name: string
  email: string
  role: string
}

type TeamAssignment = {
  id: number
  user_id: string
  role: string
  assigned_at: string
  profiles: Profile | null
}

type TeamTabProps = {
  projectId: number | null
  teamAssignments: TeamAssignment[] | undefined
  loadingTeam: boolean
  teamError: Error | null
  projectManagers: { id: string; full_name: string }[] | undefined
}

export function TeamTab({
  projectId,
  teamAssignments,
  loadingTeam,
  teamError,
  projectManagers,
}: TeamTabProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false)

  return (
    <>
      <TabsContent value="team" className="mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Team Assignments</CardTitle>
              <CardDescription>
                Manage team members assigned to this project
              </CardDescription>
            </div>
            <Button onClick={() => setIsTeamDialogOpen(true)}>Add Team Member</Button>
          </CardHeader>
          <CardContent className="p-4">
            {loadingTeam ? (
              <Skeleton className="h-48 w-full" />
            ) : teamError ? (
              <div className="py-8 text-center text-red-600">
                Error loading team: {teamError.message}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(teamAssignments || []).map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {assignment.profiles?.full_name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {assignment.profiles?.email || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={assignment.role === 'project_manager' ? 'default' : 'secondary'}>
                          {assignment.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(assignment.assigned_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            if (!confirm(`Remove ${assignment.profiles?.full_name} from team?`)) return
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const { error } = await (supabase as any)
                              .from('project_team_assignments')
                              .delete()
                              .eq('id', assignment.id)
                            if (error) {
                              alert(`Error: ${error.message}`)
                            } else {
                              queryClient.invalidateQueries({ queryKey: ['project-team', projectId] })
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(teamAssignments || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No team members assigned yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Select users to add to this project team
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {(projectManagers || []).map((user) => {
              const isAssigned = (teamAssignments || []).some(a => a.user_id === user.id)
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium">{user.full_name}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isAssigned ? 'secondary' : 'default'}
                    disabled={isAssigned}
                    onClick={async () => {
                      if (!projectId) return
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const { error } = await (supabase as any)
                        .from('project_team_assignments')
                        .insert({
                          project_id: projectId,
                          user_id: user.id,
                          role: 'team_member'
                        })
                      if (error) {
                        alert(`Error: ${error.message}`)
                      } else {
                        queryClient.invalidateQueries({ queryKey: ['project-team', projectId] })
                      }
                    }}
                  >
                    {isAssigned ? 'Already Added' : 'Add'}
                  </Button>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsTeamDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
