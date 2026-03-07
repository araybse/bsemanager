export type FreshnessState = 'fresh' | 'stale' | 'critical' | 'unknown'

export function getFreshnessState(
  timestamp: string | null | undefined,
  staleAfterHours = 24,
  criticalAfterHours = 48
): FreshnessState {
  if (!timestamp) return 'unknown'
  const ts = new Date(timestamp).getTime()
  if (Number.isNaN(ts)) return 'unknown'

  const ageMs = Date.now() - ts
  const staleMs = staleAfterHours * 60 * 60 * 1000
  const criticalMs = criticalAfterHours * 60 * 60 * 1000

  if (ageMs >= criticalMs) return 'critical'
  if (ageMs >= staleMs) return 'stale'
  return 'fresh'
}

export function freshnessLabel(state: FreshnessState): string {
  if (state === 'fresh') return 'Fresh'
  if (state === 'stale') return 'Stale'
  if (state === 'critical') return 'Critical'
  return 'Unknown'
}

export function freshnessBadgeVariant(state: FreshnessState): 'default' | 'secondary' | 'destructive' {
  if (state === 'fresh') return 'default'
  if (state === 'stale') return 'secondary'
  if (state === 'critical') return 'destructive'
  return 'secondary'
}
