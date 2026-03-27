import { createAdminClient } from '@/lib/supabase/admin'
import { fetchInvoiceById, qboQuery } from '../qbo-client'
import type { QBSettings } from '../types'
import { classifyInvoiceLineType } from '@/lib/finance/invoice-line-classification'

type QboInvoiceLine = {
  Id?: string
  Amount?: number
  Description?: string
  DetailType?: string
  SalesItemLineDetail?: {
    ItemRef?: {
      name?: string
    }
  }
}

function monthStart(value: string | null | undefined): string | null {
  const text = String(value || '').trim()
  if (!text || text.length < 7) return null
  return `${text.slice(0, 7)}-01`
}

export async function syncInvoices(
  supabase: ReturnType<typeof createAdminClient>,
  settings: QBSettings
) {
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
  const startDate = twoYearsAgo.toISOString().split('T')[0]

  const maxResults = 1000
  let startPosition = 1
  let imported = 0
  let updated = 0
  const skipped = 0
  let total = 0

  while (true) {
    const data = await qboQuery(
      settings,
      `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' ORDERBY TxnDate DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    )
    const invoices = data.QueryResponse?.Invoice || []
    total += invoices.length
    if (!invoices.length) break

    for (const invoice of invoices) {
      try {
        const qbId = invoice.Id
        const docNumber = invoice.DocNumber || `QB-${qbId}`
        const customerName = invoice.CustomerRef?.name || ''
        const projectMatch = customerName.match(/^(\d{2}-\d{2})/)
        const projectNumber = projectMatch ? projectMatch[1] : null

        let projectId = null
        if (projectNumber) {
          const { data: project } = await supabase
            .from('projects')
            .select('id')
            .eq('project_number' as never, projectNumber as never)
            .maybeSingle()
          projectId = (project as { id: number } | null)?.id || null
        }

        const balance = Number(invoice.Balance || 0)
        const totalAmt = Number(invoice.TotalAmt || 0)
        const isPaid = balance === 0 && totalAmt > 0
        const lastUpdatedDate = invoice.MetaData?.LastUpdatedTime
          ? invoice.MetaData.LastUpdatedTime.split('T')[0]
          : null

        const invoiceData = {
          invoice_number: docNumber,
          project_id: projectId,
          project_number: projectNumber,
          project_name: customerName || null,
          date_issued: invoice.TxnDate || null,
          billing_period: monthStart(invoice.TxnDate),
          budget_date: invoice.DueDate || null,
          date_paid: isPaid ? (lastUpdatedDate || invoice.TxnDate || null) : null,
          amount: totalAmt,
          qb_invoice_id: qbId,
          description_of_services: invoice.CustomerMemo?.value || null,
        }

        const { data: existing } = await supabase
          .from('invoices')
          .select('id')
          .eq('qb_invoice_id' as never, qbId as never)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('invoices')
            .update(invoiceData as never)
            .eq('id' as never, (existing as { id: number }).id as never)
          updated++
        } else {
          const { data: numberMatch } = await supabase
            .from('invoices')
            .select('id')
            .eq('invoice_number' as never, docNumber as never)
            .maybeSingle()
          if (numberMatch) {
            await supabase
              .from('invoices')
              .update({ ...invoiceData, qb_invoice_id: qbId } as never)
              .eq('id' as never, (numberMatch as { id: number }).id as never)
            updated++
          } else {
            await supabase.from('invoices').insert(invoiceData as never)
            imported++
          }
        }

        let invoiceLines = Array.isArray(invoice.Line) ? invoice.Line : null
        if (!invoiceLines) {
          try {
            const fullInvoice = await fetchInvoiceById(settings, qbId)
            invoiceLines = Array.isArray(fullInvoice?.Invoice?.Line) ? fullInvoice.Invoice.Line : []
          } catch (err) {
            console.error('Error fetching full invoice for lines:', err)
          }
        }

        if (invoiceLines && invoiceLines.length) {
          const existingInvoice =
            existing ||
            (
              await supabase
                .from('invoices')
                .select('id')
                .eq('qb_invoice_id' as never, qbId as never)
                .single()
            ).data

          if (existingInvoice) {
            const invoiceId = (existingInvoice as { id: number }).id

            await supabase
              .from('invoice_line_items')
              .delete()
              .eq('invoice_id' as never, invoiceId as never)

            const safeProjectNumber = projectNumber || null
            const safeInvoiceDate = invoice.TxnDate || null

            if (safeProjectNumber && safeInvoiceDate) {
              const lineRows = (invoiceLines as QboInvoiceLine[])
                .filter((line) => line.DetailType === 'SalesItemLineDetail' && Boolean(line.Amount))
                .map((line) => {
                  const itemName = line.SalesItemLineDetail?.ItemRef?.name || line.Description || ''
                  const lineType = classifyInvoiceLineType(itemName)
                  return {
                    invoice_id: invoiceId,
                    project_number: safeProjectNumber,
                    invoice_number: docNumber,
                    invoice_date: safeInvoiceDate,
                    billing_period: monthStart(safeInvoiceDate),
                    phase_name: itemName || 'Line Item',
                    amount: line.Amount,
                    line_type: lineType,
                    qb_line_id: line.Id || null,
                    source_table: 'qbo',
                    source_row_id: line.Id || null,
                  }
                })
              if (lineRows.length) await supabase.from('invoice_line_items').insert(lineRows as never)
            }
          }
        }
      } catch (err) {
        console.error('Error syncing invoice:', err)
      }
    }

    if (invoices.length < maxResults) break
    startPosition += maxResults
  }

  // Mark invoices deleted in QB
  // Get all QB invoice IDs we just synced
  console.log('[DELETE DETECTION] Starting delete detection for invoices...')
  const syncedQbIds = new Set<string>()
  startPosition = 1
  while (true) {
    const data = await qboQuery(
      settings,
      `SELECT Id FROM Invoice WHERE TxnDate >= '${startDate}' ORDERBY TxnDate DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    )
    const invoices = data.QueryResponse?.Invoice || []
    if (!invoices.length) break
    
    invoices.forEach((inv: { Id: string }) => syncedQbIds.add(inv.Id))
    
    if (invoices.length < maxResults) break
    startPosition += maxResults
  }

  // Find invoices in IRIS that have QB IDs but weren't in the sync
  console.log(`[DELETE DETECTION] Collected ${syncedQbIds.size} QB invoice IDs from sync`)
  const { data: irisInvoices } = await supabase
    .from('invoices')
    .select('id, qb_invoice_id, invoice_number')
    .not('qb_invoice_id', 'is', null)
    .gte('date_issued' as never, startDate as never)
  
  console.log(`[DELETE DETECTION] Found ${irisInvoices?.length || 0} IRIS invoices with QB IDs to check`)

  if (irisInvoices && irisInvoices.length > 0) {
    const deletedIds: number[] = []
    for (const invoice of irisInvoices) {
      const inv = invoice as { id: number; qb_invoice_id: string; invoice_number: string }
      if (!syncedQbIds.has(inv.qb_invoice_id)) {
        deletedIds.push(inv.id)
        console.log(`Marking invoice as deleted: ${inv.invoice_number} (QB ID: ${inv.qb_invoice_id})`)
      }
    }

    if (deletedIds.length > 0) {
      console.log(`[DELETE DETECTION] Marking ${deletedIds.length} invoice(s) as deleted...`)
      await supabase
        .from('invoices')
        .update({ 
          status: 'deleted',
          deleted_at: new Date().toISOString() 
        } as never)
        .in('id' as never, deletedIds as never)
      
      console.log(`[DELETE DETECTION] ✅ Successfully marked ${deletedIds.length} invoice(s) as deleted`)
    } else {
      console.log('[DELETE DETECTION] No invoices to mark as deleted')
    }
  }

  return { imported, updated, skipped, total }
}
