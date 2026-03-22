export type QBSettings = {
  id: number
  access_token: string
  refresh_token: string
  realm_id: string
  token_expires_at: string
  connected_at: string
  updated_at: string
  last_contract_labor_sync_at?: string | null
  last_expense_sync_at?: string | null
  last_payment_sync_at?: string | null
}

export type SyncType =
  | 'all'
  | 'time'
  | 'customers'
  | 'projects'
  | 'invoices'
  | 'contract_labor'
  | 'expenses'
  | 'payments'
