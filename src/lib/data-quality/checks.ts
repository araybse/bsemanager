import { createAdminClient } from '@/lib/supabase/admin'
import { isInvoiceAdjustmentLabel } from '@/lib/finance/invoice-line-classification'

export type DataQualityChecks = {
  phaseNameMismatches: {
    count: number
    top: Array<{
      line_item_id: number
      project_number: string
      project_name: string | null
      invoice_number: string
      phase_name: string
      amount: number
      suggested_phase_name: string | null
      available_phase_names: string[]
    }>
  }
  duplicateCostCandidates: {
    count: number
    top: Array<{
      project_number: string
      expense_date: string
      fee_amount: number
      description: string
      row_count: number
      source_types: string[]
    }>
  }
}

function normalizeText(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string | null | undefined) {
  const normalized = normalizeText(value)
  if (!normalized) return [] as string[]
  return normalized.split(' ').filter(Boolean)
}

function pickSuggestedPhaseName(sourcePhase: string, candidates: string[]) {
  const sourceTokens = new Set(tokenize(sourcePhase))
  if (!sourceTokens.size || !candidates.length) return null

  let bestCandidate: string | null = null
  let bestScore = -1
  for (const candidate of candidates) {
    const candidateTokens = new Set(tokenize(candidate))
    if (!candidateTokens.size) continue
    let overlap = 0
    sourceTokens.forEach((token) => {
      if (candidateTokens.has(token)) overlap += 1
    })
    const score = overlap / Math.max(sourceTokens.size, candidateTokens.size)
    if (score > bestScore) {
      bestScore = score
      bestCandidate = candidate
    }
  }

  if (bestScore < 0.35) return null
  return bestCandidate
}

export async function computeDataQualityChecks(supabase: ReturnType<typeof createAdminClient>): Promise<DataQualityChecks> {
  const [{ data: projectRows, error: projectError }, { data: phaseRows, error: phaseError }] =
    await Promise.all([
      supabase.from('projects').select('id, project_number, name'),
      supabase.from('contract_phases').select('project_id, phase_name'),
    ])
  if (projectError) throw projectError
  if (phaseError) throw phaseError

  const projectIdToNumber = new Map<number, string>()
  const projectNameByNumber = new Map<string, string | null>()
  ;(
    (projectRows as Array<{ id: number; project_number: string | null; name: string | null }> | null) || []
  ).forEach((row) => {
    const projectNumber = (row.project_number || '').trim()
    if (projectNumber) {
      projectIdToNumber.set(row.id, projectNumber)
      projectNameByNumber.set(projectNumber, row.name || null)
    }
  })

  const phaseSetByProjectNumber = new Map<string, Set<string>>()
  const phaseListByProjectNumber = new Map<string, string[]>()
  ;((phaseRows as Array<{ project_id: number; phase_name: string | null }> | null) || []).forEach((row) => {
    const projectNumber = projectIdToNumber.get(row.project_id)
    if (!projectNumber) return
    const rawPhaseName = (row.phase_name || '').trim()
    const normalized = normalizeText(row.phase_name)
    if (!normalized) return
    if (!phaseSetByProjectNumber.has(projectNumber)) {
      phaseSetByProjectNumber.set(projectNumber, new Set())
      phaseListByProjectNumber.set(projectNumber, [])
    }
    phaseSetByProjectNumber.get(projectNumber)!.add(normalized)
    phaseListByProjectNumber.get(projectNumber)!.push(rawPhaseName)
  })

  const { data: lineItems, error: lineItemsError } = await supabase
    .from('invoice_line_items')
    .select('id, project_number, invoice_number, phase_name, amount, line_type')
  if (lineItemsError) throw lineItemsError

  const phaseMismatches: DataQualityChecks['phaseNameMismatches']['top'] = []
  ;(
    (
      lineItems as Array<{
        project_number: string | null
        invoice_number: string | null
        phase_name: string | null
        amount: number | null
        line_type: string | null
        id: number
      }> | null
    ) || []
  ).forEach((line) => {
    if ((line.line_type || '').toLowerCase() === 'reimbursable') return
    if ((line.line_type || '').toLowerCase() === 'adjustment') return
    if (isInvoiceAdjustmentLabel(line.phase_name || '')) return
    const projectNumber = (line.project_number || '').trim()
    const phaseName = normalizeText(line.phase_name)
    if (!projectNumber || !phaseName) return
    const phaseSet = phaseSetByProjectNumber.get(projectNumber)
    if (!phaseSet || !phaseSet.has(phaseName)) {
      phaseMismatches.push({
        line_item_id: line.id,
        project_number: projectNumber,
        project_name: projectNameByNumber.get(projectNumber) || null,
        invoice_number: line.invoice_number || 'Unknown',
        phase_name: line.phase_name || 'Unknown',
        amount: Number(line.amount) || 0,
        suggested_phase_name: pickSuggestedPhaseName(
          line.phase_name || '',
          phaseListByProjectNumber.get(projectNumber) || []
        ),
        available_phase_names: phaseListByProjectNumber.get(projectNumber) || [],
      })
    }
  })

  const { data: expenseRows, error: expenseError } = await supabase
    .from('project_expenses')
    .select('project_number, expense_date, fee_amount, description, source_entity_type')
  if (expenseError) throw expenseError

  const duplicateGroups = new Map<
    string,
    {
      project_number: string
      expense_date: string
      fee_amount: number
      description: string
      row_count: number
      source_types: Set<string>
      hasReimbursableSource: boolean
      hasLaborSource: boolean
    }
  >()

  ;(
    (
      expenseRows as Array<{
        project_number: string | null
        expense_date: string
        fee_amount: number | null
        description: string | null
        source_entity_type: string | null
      }> | null
    ) || []
  ).forEach((row) => {
    const projectNumber = (row.project_number || '').trim()
    const expenseDate = row.expense_date
    const feeAmount = Number(row.fee_amount) || 0
    const description = normalizeText(row.description)
    if (!projectNumber || !expenseDate || !feeAmount) return

    const key = `${projectNumber}::${expenseDate}::${feeAmount.toFixed(2)}::${description}`
    const sourceType = (row.source_entity_type || 'unknown').trim().toLowerCase()
    if (!duplicateGroups.has(key)) {
      duplicateGroups.set(key, {
        project_number: projectNumber,
        expense_date: expenseDate,
        fee_amount: feeAmount,
        description: row.description || '',
        row_count: 0,
        source_types: new Set(),
        hasReimbursableSource: false,
        hasLaborSource: false,
      })
    }

    const group = duplicateGroups.get(key)!
    group.row_count += 1
    group.source_types.add(sourceType)
    if (sourceType.includes('reimb')) group.hasReimbursableSource = true
    if (sourceType.includes('labor') || sourceType.includes('contract')) group.hasLaborSource = true
  })

  const duplicateCandidates: DataQualityChecks['duplicateCostCandidates']['top'] = Array.from(duplicateGroups.values())
    .filter((group) => group.row_count > 1 && group.hasReimbursableSource && group.hasLaborSource)
    .map((group) => ({
      project_number: group.project_number,
      expense_date: group.expense_date,
      fee_amount: group.fee_amount,
      description: group.description,
      row_count: group.row_count,
      source_types: Array.from(group.source_types).sort(),
    }))
    .sort((a, b) => b.row_count - a.row_count)

  return {
    phaseNameMismatches: {
      count: phaseMismatches.length,
      top: phaseMismatches.slice(0, 100),
    },
    duplicateCostCandidates: {
      count: duplicateCandidates.length,
      top: duplicateCandidates.slice(0, 100),
    },
  }
}
