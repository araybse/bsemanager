'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'

interface ProjectPhaseSelectorProps {
  onAdd: (project: { id: number; number: string; name: string }, phase: string) => void
}

export function ProjectPhaseSelector({ onAdd }: ProjectPhaseSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<{
    id: number
    project_number: string
    name: string
  } | null>(null)
  const [selectedPhase, setSelectedPhase] = useState<string>('')
  const [projectSearch, setProjectSearch] = useState('')

  const supabase = createClient()

  // Fetch active projects
  const { data: projects } = useQuery({
    queryKey: ['active-projects-timesheet'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, project_number, name')
        .eq('status', 'active')
        .order('project_number', { ascending: false })
      return data || []
    }
  })

  // Fetch phases for selected project
  const { data: phases } = useQuery({
    queryKey: ['project-phases-timesheet', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject) return []
      const { data } = await supabase
        .from('contract_phases')
        .select('phase_name')
        .eq('project_id', selectedProject.id)
        .order('phase_name')
      return (data as Array<{ phase_name: string }> || []).map(p => p.phase_name)
    },
    enabled: !!selectedProject
  })

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!projects) return []
    if (!projectSearch) return projects // Show all projects when no search
    const search = projectSearch.toLowerCase()
    return projects.filter((p: { project_number: string; name: string | null }) => 
      p.project_number.toLowerCase().includes(search) ||
      p.name?.toLowerCase().includes(search)
    )
  }, [projects, projectSearch])

  const handleAdd = () => {
    if (selectedProject && selectedPhase) {
      onAdd(
        { id: selectedProject.id, number: selectedProject.project_number, name: selectedProject.name },
        selectedPhase
      )
      setOpen(false)
      setSelectedProject(null)
      setSelectedPhase('')
      setProjectSearch('')
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Reset state when closing
      setSelectedProject(null)
      setSelectedPhase('')
      setProjectSearch('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Project to Timesheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Project</label>
            <Command className="border rounded-md">
              <CommandInput 
                placeholder="Search by project number..." 
                value={projectSearch}
                onValueChange={setProjectSearch}
              />
              <CommandList className="max-h-[200px]">
                <CommandEmpty>No projects found</CommandEmpty>
                <CommandGroup>
                  {filteredProjects.map((project: { id: number; project_number: string; name: string | null }) => (
                    <CommandItem
                      key={project.id}
                      onSelect={() => {
                        setSelectedProject(project as { id: number; project_number: string; name: string })
                        setSelectedPhase('')
                      }}
                      className={selectedProject?.id === project.id ? 'bg-accent' : ''}
                    >
                      <span className="font-medium">{project.project_number}</span>
                      {project.name && (
                        <span className="ml-2 text-muted-foreground truncate">
                          {project.name}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            {selectedProject && (
              <p className="text-sm text-muted-foreground">
                Selected: <span className="font-medium">{selectedProject.project_number}</span>
              </p>
            )}
          </div>

          {/* Phase Selection */}
          {selectedProject && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Phase</label>
              <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a phase..." />
                </SelectTrigger>
                <SelectContent>
                  {phases?.map((phase: string) => (
                    <SelectItem key={phase} value={phase}>
                      {phase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={!selectedProject || !selectedPhase}
          >
            Add to Timesheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
