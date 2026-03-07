const ADJUSTMENT_PATTERNS: RegExp[] = [
  /\bbounced\s+check\b/i,
  /\breturned\s+check\b/i,
  /\bnsf\b/i,
  /\bnon[-\s]?sufficient\s+funds\b/i,
  /\bcheck\s+return(ed)?\b/i,
]

export function isInvoiceAdjustmentLabel(value: string | null | undefined) {
  const text = (value || '').trim()
  if (!text) return false
  return ADJUSTMENT_PATTERNS.some((pattern) => pattern.test(text))
}

export function classifyInvoiceLineType(value: string | null | undefined) {
  const text = (value || '').toLowerCase()
  if (isInvoiceAdjustmentLabel(value)) return 'adjustment' as const
  if (text.includes('reimb')) return 'reimbursable' as const
  return 'phase' as const
}
