'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

type ClientContact = {
  id: string
  client_id: number
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  title: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

type ClientContactsDialogProps = {
  clientId: number | null
  clientName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClientContactsDialog({ clientId, clientName, open, onOpenChange }: ClientContactsDialogProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null)
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  })

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('client_contacts' as never)
        .select('*')
        .eq('client_id' as never, clientId as never)
        .order('last_name' as never, { ascending: true })
      if (error) throw error
      return (data || []) as ClientContact[]
    },
    enabled: !!clientId && open,
  })

  const addContactMutation = useMutation({
    mutationFn: async (newContact: typeof contactForm) => {
      if (!clientId) throw new Error('No client selected')
      const { data, error } = await supabase
        .from('client_contacts' as never)
        .insert({
          client_id: clientId,
          ...newContact,
        } as never)
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', clientId] })
      toast.success('Contact added')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(`Failed to add contact: ${error.message}`)
    },
  })

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientContact> }) => {
      const { error } = await supabase
        .from('client_contacts' as never)
        .update(data as never)
        .eq('id' as never, id as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', clientId] })
      toast.success('Contact updated')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(`Failed to update contact: ${error.message}`)
    },
  })

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_contacts' as never)
        .delete()
        .eq('id' as never, id as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', clientId] })
      toast.success('Contact deleted')
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete contact: ${error.message}`)
    },
  })

  const resetForm = () => {
    setContactForm({ first_name: '', last_name: '', email: '', phone: '' })
    setEditingContact(null)
    setIsAddingContact(false)
  }

  const handleAddContact = () => {
    setIsAddingContact(true)
    setEditingContact(null)
    setContactForm({ first_name: '', last_name: '', email: '', phone: '' })
  }

  const handleEditContact = (contact: ClientContact) => {
    setEditingContact(contact)
    setIsAddingContact(true)
    setContactForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
    })
  }

  const handleSaveContact = () => {
    if (!contactForm.first_name || !contactForm.last_name) {
      toast.error('First name and last name are required')
      return
    }

    if (editingContact) {
      updateContactMutation.mutate({
        id: editingContact.id,
        data: contactForm,
      })
    } else {
      addContactMutation.mutate(contactForm)
    }
  }

  const handleDeleteContact = (contact: ClientContact) => {
    if (confirm(`Delete contact ${contact.first_name} ${contact.last_name}?`)) {
      deleteContactMutation.mutate(contact.id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-none" style={{ width: '900px' }}>
        <DialogHeader>
          <DialogTitle>Contacts for {clientName}</DialogTitle>
          <DialogDescription>
            Manage contact information for this client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isAddingContact && (
            <div className="flex justify-end">
              <Button onClick={handleAddContact} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
            </div>
          )}

          {isAddingContact && (
            <div className="grid gap-4 p-4 border rounded-md bg-muted/50">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name *</Label>
                  <Input
                    id="first-name"
                    value={contactForm.first_name}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name *</Label>
                  <Input
                    id="last-name"
                    value={contactForm.last_name}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button onClick={handleSaveContact}>
                  {editingContact ? 'Update' : 'Add'} Contact
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(contacts || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No contacts yet. Click "Add Contact" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  (contacts || []).map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>{contact.first_name}</TableCell>
                      <TableCell>{contact.last_name}</TableCell>
                      <TableCell>{contact.email || '—'}</TableCell>
                      <TableCell>{contact.phone || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditContact(contact)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteContact(contact)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
