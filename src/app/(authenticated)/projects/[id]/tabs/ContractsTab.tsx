'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils/format'
import { toast } from 'sonner'

export interface ContractSummary {
  id: number
  vendor_name: string
  description: string | null
  status: 'active' | 'closed' | 'cancelled'
  original_amount: number
  paid_to_date: number
  outstanding_amount: number
  start_date?: string | null
  end_date?: string | null
}

export interface ContractsTabProps {
  projectId: number
  loadingSubcontractContracts: boolean
  loadingExpenses: boolean
  contractSummaries: ContractSummary[]
}

export function ContractsTab({
  projectId,
  loadingSubcontractContracts,
  loadingExpenses,
  contractSummaries,
}: ContractsTabProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false)
  const [isSavingContract, setIsSavingContract] = useState(false)
  const [isDeletingContract, setIsDeletingContract] = useState(false)
  const [editingSubcontractContract, setEditingSubcontractContract] = useState<ContractSummary | null>(null)
  const [contractForm, setContractForm] = useState({
    vendor_name: '',
    description: '',
    original_amount: '',
    status: 'active' as 'active' | 'closed' | 'cancelled',
    start_date: '',
    end_date: '',
  })

  const openCreateContractDialog = () => {
    setEditingSubcontractContract(null)
    setContractForm({
      vendor_name: '',
      description: '',
      original_amount: '',
      status: 'active',
      start_date: '',
      end_date: '',
    })
    setIsContractDialogOpen(true)
  }

  const openEditContractDialog = (contract: ContractSummary) => {
    setEditingSubcontractContract(contract)
    setContractForm({
      vendor_name: contract.vendor_name,
      description: contract.description || '',
      original_amount: String(contract.original_amount || ''),
      status: contract.status,
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
    })
    setIsContractDialogOpen(true)
  }

  const closeContractDialog = () => {
    setIsContractDialogOpen(false)
    setEditingSubcontractContract(null)
    setContractForm({
      vendor_name: '',
      description: '',
      original_amount: '',
      status: 'active',
      start_date: '',
      end_date: '',
    })
  }

  const saveContract = async () => {
    if (!contractForm.vendor_name.trim()) {
      toast.error('Vendor name is required')
      return
    }
    setIsSavingContract(true)
    try {
      const payload = {
        project_id: projectId,
        vendor_name: contractForm.vendor_name.trim(),
        description: contractForm.description.trim() || null,
        original_amount: Number(contractForm.original_amount) || 0,
        status: contractForm.status,
        start_date: contractForm.start_date || null,
        end_date: contractForm.end_date || null,
      }
      if (editingSubcontractContract) {
        const { error } = await supabase
          .from('subcontract_contracts' as never)
          .update(payload as never)
          .eq('id' as never, editingSubcontractContract.id as never)
        if (error) throw error
        toast.success('Contract updated')
      } else {
        const { error } = await supabase.from('subcontract_contracts' as never).insert(payload as never)
        if (error) throw error
        toast.success('Contract created')
      }
      queryClient.invalidateQueries({ queryKey: ['subcontract-contracts', projectId] })
      closeContractDialog()
    } catch (err) {
      console.error(err)
      toast.error('Failed to save contract')
    } finally {
      setIsSavingContract(false)
    }
  }

  const deleteContract = async () => {
    if (!editingSubcontractContract) return
    setIsDeletingContract(true)
    try {
      const { error } = await supabase
        .from('subcontract_contracts' as never)
        .delete()
        .eq('id' as never, editingSubcontractContract.id as never)
      if (error) throw error
      toast.success('Contract deleted')
      queryClient.invalidateQueries({ queryKey: ['subcontract-contracts', projectId] })
      closeContractDialog()
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete contract')
    } finally {
      setIsDeletingContract(false)
    }
  }

  return (
    <>
      <TabsContent value="contracts" className="mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Subcontract Contracts</CardTitle>
              <CardDescription>
                Track original amount, paid-to-date, and outstanding by contract.
              </CardDescription>
            </div>
            <Button onClick={openCreateContractDialog}>Add Contract</Button>
          </CardHeader>
          <CardContent className="p-4">
            {loadingSubcontractContracts || loadingExpenses ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Original Amount</TableHead>
                    <TableHead className="text-right">Paid To Date</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractSummaries.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>{contract.vendor_name}</TableCell>
                      <TableCell>{contract.description || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={contract.status === 'active' ? 'default' : 'secondary'}>
                          {contract.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(Number(contract.original_amount) || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(contract.paid_to_date)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(contract.outstanding_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditContractDialog(contract)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {contractSummaries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No contracts
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingSubcontractContract ? 'Edit Contract' : 'Add Contract'}</DialogTitle>
            <DialogDescription>
              Contracts are unlimited per project/vendor. Link expenses from the Expenses tab.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Vendor</label>
              <Input
                value={contractForm.vendor_name}
                onChange={(event) =>
                  setContractForm((prev) => ({ ...prev, vendor_name: event.target.value }))
                }
                placeholder="Vendor name"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={contractForm.description}
                onChange={(event) =>
                  setContractForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional contract description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Original Amount</label>
                <Input
                  value={contractForm.original_amount}
                  onChange={(event) =>
                    setContractForm((prev) => ({ ...prev, original_amount: event.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={contractForm.status}
                  onValueChange={(value: 'active' | 'closed' | 'cancelled') =>
                    setContractForm((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="closed">closed</SelectItem>
                    <SelectItem value="cancelled">cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={contractForm.start_date}
                  onChange={(event) =>
                    setContractForm((prev) => ({ ...prev, start_date: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={contractForm.end_date}
                  onChange={(event) =>
                    setContractForm((prev) => ({ ...prev, end_date: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between gap-2">
            <div>
              {editingSubcontractContract && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void deleteContract()}
                  disabled={isSavingContract || isDeletingContract}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={closeContractDialog}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void saveContract()}
                disabled={isSavingContract || isDeletingContract}
              >
                {isSavingContract ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
