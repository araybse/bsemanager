import { describe, expect, it } from 'vitest'
import { classifyInvoiceLineType, isInvoiceAdjustmentLabel } from './invoice-line-classification'

describe('isInvoiceAdjustmentLabel', () => {
  it('detects bounced check labels', () => {
    expect(isInvoiceAdjustmentLabel('Bounced Check - invoice correction')).toBe(true)
    expect(isInvoiceAdjustmentLabel('NSF reversal')).toBe(true)
    expect(isInvoiceAdjustmentLabel('Returned check fee')).toBe(true)
  })

  it('does not classify normal lines as adjustments', () => {
    expect(isInvoiceAdjustmentLabel('Schematic design')).toBe(false)
    expect(isInvoiceAdjustmentLabel('Reimbursable travel')).toBe(false)
  })
})

describe('classifyInvoiceLineType', () => {
  it('classifies adjustment lines first', () => {
    expect(classifyInvoiceLineType('Bounced check reimb')).toBe('adjustment')
  })

  it('classifies reimbursables', () => {
    expect(classifyInvoiceLineType('Reimbursable parking')).toBe('reimbursable')
  })

  it('defaults to phase', () => {
    expect(classifyInvoiceLineType('Construction documents')).toBe('phase')
  })
})
