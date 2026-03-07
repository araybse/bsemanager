export type CanonicalValueContext = {
  project: Record<string, unknown> | null
  projectInfo: Record<string, unknown> | null
  bseInfo: Record<string, unknown> | null
  projectInfoMultiByColumn?: Record<string, string[]>
}

const toText = (value: unknown) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

const getPathValue = (source: Record<string, unknown> | null, path: string) => {
  if (!source) return ''
  const value = source[path]
  return toText(value)
}

export function resolveCanonicalValue(context: CanonicalValueContext, canonicalKey: string): string {
  if (!canonicalKey) return ''

  if (canonicalKey.startsWith('projectInfo.')) {
    const key = canonicalKey.replace('projectInfo.', '')
    const multiValues = context.projectInfoMultiByColumn?.[key]
    if (Array.isArray(multiValues) && multiValues.length > 0) {
      return multiValues.join(', ')
    }

    const indexedMatch = key.match(/^(.*)\[(\d+)\]$/)
    if (indexedMatch) {
      const columnName = indexedMatch[1]
      const index = Number(indexedMatch[2])
      const list = context.projectInfoMultiByColumn?.[columnName] || []
      return list[index] || ''
    }

    if (key.endsWith('_joined_newline')) {
      const columnName = key.replace(/_joined_newline$/, '')
      const list = context.projectInfoMultiByColumn?.[columnName] || []
      return list.join('\n')
    }

    if (key.endsWith('_joined')) {
      const columnName = key.replace(/_joined$/, '')
      const list = context.projectInfoMultiByColumn?.[columnName] || []
      return list.join(', ')
    }

    if (key.endsWith('_count')) {
      const columnName = key.replace(/_count$/, '')
      const list = context.projectInfoMultiByColumn?.[columnName] || []
      return list.length ? String(list.length) : ''
    }

    return getPathValue(context.projectInfo, key)
  }
  if (canonicalKey.startsWith('project.')) {
    return getPathValue(context.project, canonicalKey.replace('project.', ''))
  }
  if (canonicalKey.startsWith('bseInfo.')) {
    return getPathValue(context.bseInfo, canonicalKey.replace('bseInfo.', ''))
  }

  switch (canonicalKey) {
    case 'projectNumber':
      return getPathValue(context.project, 'project_number') || getPathValue(context.projectInfo, 'project_number')
    case 'projectName':
      return getPathValue(context.project, 'name') || getPathValue(context.projectInfo, 'project_name')
    case 'clientName':
      return getPathValue(context.projectInfo, 'client_name')
    case 'engineerName':
      return getPathValue(context.projectInfo, 'project_engineer')
    default:
      return ''
  }
}

export function applyTransformRule(value: string, transformRule: string | null | undefined): string {
  const base = value || ''
  if (!transformRule) return base

  const rule = transformRule.trim().toLowerCase()
  if (!rule) return base

  if (rule === 'uppercase') return base.toUpperCase()

  if (rule === 'phone') {
    const digits = base.replace(/\D/g, '')
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    }
    return base
  }

  if (rule === 'date_mmddyyyy') {
    const parsed = new Date(base)
    if (Number.isNaN(parsed.getTime())) return base
    const mm = `${parsed.getMonth() + 1}`.padStart(2, '0')
    const dd = `${parsed.getDate()}`.padStart(2, '0')
    const yyyy = parsed.getFullYear()
    return `${mm}/${dd}/${yyyy}`
  }

  return base
}
