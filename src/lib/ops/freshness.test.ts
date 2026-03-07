import { afterEach, describe, expect, it, vi } from 'vitest'
import { freshnessLabel, getFreshnessState } from './freshness'

describe('getFreshnessState', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns unknown when timestamp is missing', () => {
    expect(getFreshnessState(null)).toBe('unknown')
  })

  it('returns fresh for recent timestamps', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-30T12:00:00.000Z'))
    expect(getFreshnessState('2026-01-30T02:00:00.000Z', 24, 72)).toBe('fresh')
  })

  it('returns stale after stale threshold', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-30T12:00:00.000Z'))
    expect(getFreshnessState('2026-01-29T00:00:00.000Z', 24, 72)).toBe('stale')
  })

  it('returns critical after critical threshold', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-30T12:00:00.000Z'))
    expect(getFreshnessState('2026-01-26T11:59:00.000Z', 24, 72)).toBe('critical')
  })
})

describe('freshnessLabel', () => {
  it('maps states to labels', () => {
    expect(freshnessLabel('fresh')).toBe('Fresh')
    expect(freshnessLabel('stale')).toBe('Stale')
    expect(freshnessLabel('critical')).toBe('Critical')
    expect(freshnessLabel('unknown')).toBe('Unknown')
  })
})
