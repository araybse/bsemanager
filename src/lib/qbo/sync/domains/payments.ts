import { createAdminClient } from '@/lib/supabase/admin'
import { extractProjectNumberFromName, qboQuery } from '../qbo-client'
import type { QBSettings } from '../types'

type QboLinkedTxn = {
  TxnId?: string
  TxnType?: string
}

type QboPaymentLine = {
  Amount?: number | string
  LinkedTxn?: QboLinkedTxn[]
}

type QboPayment = {
  Id?: string
  DocNumber?: string
  TxnDate?: string
  TotalAmt?: number | string
  UnappliedAmt?: number | string
  CustomerRef?: {
    name?: string
    value?: string
  }
  MetaData?: {
    LastUpdatedTime?: string
  }
  Line?: QboPaymentLine[]
}

function asNumber(value: unknown): number {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function syncPayments(
  supabase: ReturnType<typeof createAdminClient>,
  settings: QBSettings
) {
  const startDate = '2023-05-01'

  const maxResults = 1000
  let startPosition = 1
  let imported = 0
  let updated = 0
  let skipped = 0
  const deleted = 0
  let errors = 0
  let total = 0

  const affectedQbInvoiceIds = new Set<string>()

  while (true) {
    const payload = await qboQuery(
      settings,
      `SELECT * FROM Payment WHERE TxnDate >= '${startDate}' ORDERBY TxnDate DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    )
    const payments = (payload?.QueryResponse?.Payment as QboPayment[] | undefined) || []
    total += payments.length
    if (!payments.length) break

    for (const payment of payments) {
      try {
        const qbPaymentId = String(payment.Id || '').trim()
        const paymentDate = String(payment.TxnDate || '').trim()
        if (!qbPaymentId || !paymentDate) {
          skipped += 1
          continue
        }

        const customerName = payment.CustomerRef?.name || null
        const projectNumber = extractProjectNumberFromName(customerName || undefined)
        const totalAmount = asNumber(payment.TotalAmt)
        const unappliedAmount = asNumber(payment.UnappliedAmt)
        const upsertPayload = {
          qb_payment_id: qbPaymentId,
          payment_number: payment.DocNumber || null,
          payment_date: paymentDate,
          customer_name: customerName,
          customer_qb_id: payment.CustomerRef?.value || null,
          total_amount: totalAmount,
          unapplied_amount: unappliedAmount,
          project_number: projectNumber,
          project_name: customerName,
          last_updated_time: payment.MetaData?.LastUpdatedTime || null,
          raw_payload: payment,
          updated_at: new Date().toISOString(),
        }

        const { data: existingPayment } = await supabase
          .from('qbo_payments' as never)
          .select('id')
          .eq('qb_payment_id' as never, qbPaymentId as never)
          .maybeSingle()

        await supabase
          .from('qbo_payments' as never)
          .upsert(upsertPayload as never, { onConflict: 'qb_payment_id' as never })

        if (existingPayment) updated += 1
        else imported += 1

        await supabase
          .from('qbo_payment_allocations' as never)
          .delete()
          .eq('qb_payment_id' as never, qbPaymentId as never)

        const lines = Array.isArray(payment.Line) ? payment.Line : []
        const invoiceLinks: Array<{ qbInvoiceId: string; amount: number }> = []

        for (const line of lines) {
          const linkedInvoices = (line.LinkedTxn || []).filter((txn) => txn.TxnType === 'Invoice' && txn.TxnId)
          if (!linkedInvoices.length) continue
          const lineAmount = asNumber(line.Amount)
          if (lineAmount <= 0) continue
          const amountPerLink = lineAmount / linkedInvoices.length
          linkedInvoices.forEach((txn) => {
            const qbInvoiceId = String(txn.TxnId || '').trim()
            if (!qbInvoiceId) return
            invoiceLinks.push({ qbInvoiceId, amount: amountPerLink })
            affectedQbInvoiceIds.add(qbInvoiceId)
          })
        }

        if (invoiceLinks.length) {
          const uniqueQbInvoiceIds = Array.from(new Set(invoiceLinks.map((item) => item.qbInvoiceId)))
          const { data: invoices } = await supabase
            .from('invoices' as never)
            .select('id, qb_invoice_id, invoice_number, project_number, project_name')
            .in('qb_invoice_id' as never, uniqueQbInvoiceIds as never)

          const invoiceByQbId = new Map<
            string,
            {
              id: number
              invoice_number: string | null
              project_number: string | null
              project_name: string | null
            }
          >()
          ;(
            (invoices as
              | Array<{
                  id: number
                  qb_invoice_id: string
                  invoice_number: string | null
                  project_number: string | null
                  project_name: string | null
                }>
              | null) || []
          ).forEach((invoice) => {
            if (invoice.qb_invoice_id) {
              invoiceByQbId.set(invoice.qb_invoice_id, {
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                project_number: invoice.project_number,
                project_name: invoice.project_name,
              })
            }
          })

          const allocationRows = invoiceLinks.map((link) => {
            const invoiceMatch = invoiceByQbId.get(link.qbInvoiceId)
            return {
              qb_payment_id: qbPaymentId,
              qb_invoice_id: link.qbInvoiceId,
              invoice_id: invoiceMatch?.id || null,
              invoice_number: invoiceMatch?.invoice_number || null,
              project_number: invoiceMatch?.project_number || projectNumber || null,
              project_name: invoiceMatch?.project_name || customerName || null,
              payment_date: paymentDate,
              applied_amount: link.amount,
              applied_services_amount: link.amount,
              updated_at: new Date().toISOString(),
            }
          })

          if (allocationRows.length) {
            await supabase.from('qbo_payment_allocations' as never).insert(allocationRows as never)
          }
        } else {
          skipped += 1
        }
      } catch (error) {
        errors += 1
        console.error('Error syncing payment row:', error)
      }
    }

    if (payments.length < maxResults) break
    startPosition += maxResults
  }

  if (affectedQbInvoiceIds.size > 0) {
    const qbInvoiceIds = Array.from(affectedQbInvoiceIds)
    const { data: allocationRows } = await supabase
      .from('qbo_payment_allocations' as never)
      .select('qb_invoice_id, payment_date, applied_amount')
      .in('qb_invoice_id' as never, qbInvoiceIds as never)

    const paidTotalsByInvoice = new Map<string, number>()
    const lastPaidDateByInvoice = new Map<string, string>()
    ;(
      (allocationRows as Array<{ qb_invoice_id: string; payment_date: string; applied_amount: number | null }> | null) ||
      []
    ).forEach((row) => {
      const qbInvoiceId = row.qb_invoice_id
      const amount = asNumber(row.applied_amount)
      paidTotalsByInvoice.set(qbInvoiceId, (paidTotalsByInvoice.get(qbInvoiceId) || 0) + amount)
      const lastPaidDate = lastPaidDateByInvoice.get(qbInvoiceId)
      if (!lastPaidDate || row.payment_date > lastPaidDate) {
        lastPaidDateByInvoice.set(qbInvoiceId, row.payment_date)
      }
    })

    const { data: invoicesToUpdate } = await supabase
      .from('invoices' as never)
      .select('id, qb_invoice_id, amount')
      .in('qb_invoice_id' as never, qbInvoiceIds as never)

    for (const invoice of ((invoicesToUpdate as Array<{ id: number; qb_invoice_id: string; amount: number }> | null) || [])) {
      const paidTotal = paidTotalsByInvoice.get(invoice.qb_invoice_id) || 0
      const invoiceAmount = asNumber(invoice.amount)
      const datePaid = paidTotal + 0.009 >= invoiceAmount ? lastPaidDateByInvoice.get(invoice.qb_invoice_id) || null : null
      await supabase
        .from('invoices' as never)
        .update({ date_paid: datePaid } as never)
        .eq('id' as never, invoice.id as never)
    }
  }

  return { imported, updated, deleted, skipped, errors, total }
}
