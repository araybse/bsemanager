export type ExpenseBillingStatus = 'pending' | 'approved' | 'invoiced' | 'paid' | 'ignored'

const VALID_BILLING_STATUSES: ExpenseBillingStatus[] = ['pending', 'approved', 'invoiced', 'paid', 'ignored']

function asLower(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function isValidBillingStatus(value: string): value is ExpenseBillingStatus {
  return VALID_BILLING_STATUSES.includes(value as ExpenseBillingStatus)
}

export function normalizeExpenseBillingStatus(input: {
  status?: string | null
  billing_status?: string | null
  is_reimbursable?: boolean | null
  invoice_id?: number | null
  invoice_number?: string | null
}): ExpenseBillingStatus {
  const billingStatus = asLower(input.billing_status)
  if (isValidBillingStatus(billingStatus)) return billingStatus

  const legacyStatus = asLower(input.status)
  if (legacyStatus === 'invoiced') return 'invoiced'
  if (legacyStatus === 'paid') return 'paid'
  if (legacyStatus === 'to_be_invoiced' || legacyStatus === 'approved') return 'approved'
  if (legacyStatus === 'not_reimbursable' || legacyStatus === 'ignored') return 'ignored'

  if (input.invoice_id || (input.invoice_number || '').trim().length > 0) return 'invoiced'
  if (input.is_reimbursable === false) return 'ignored'

  return 'pending'
}

export function legacyStatusFromBillingStatus(status: ExpenseBillingStatus): string {
  if (status === 'approved') return 'to_be_invoiced'
  if (status === 'ignored') return 'not_reimbursable'
  return status
}

export function isExpenseInvoicedStatus(status: ExpenseBillingStatus): boolean {
  return status === 'invoiced' || status === 'paid'
}
