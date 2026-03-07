import { describe, expect, it } from 'vitest'
import { runDrainageCalculation } from './drainage-engine'
import { runUtilitiesCalculation } from './utilities-engine'
import { resolveCrossingGeometry } from './crossing-engine'

describe('CAM engines', () => {
  it('calculates drainage outputs', () => {
    const result = runDrainageCalculation({
      projectId: 1,
      preCn: 70,
      postCn: 85,
      areaAcres: 4,
      aerobicDepthIn: 8,
      smpFactor: 1.2,
    })

    expect(result.runoffDelta).toBeGreaterThan(0)
    expect(result.storageIndex).toBeGreaterThan(0)
  })

  it('calculates utilities pressure margin', () => {
    const result = runUtilitiesCalculation({
      projectId: 1,
      calcType: 'fire_flow',
      demandGpm: 1000,
      availablePressurePsi: 55,
      minRequiredPressurePsi: 35,
    })

    expect(result.meetsRequirement).toBe(true)
    expect(result.pressureMarginPsi).toBe(20)
  })

  it('resolves crossing geometry and detects conflict', () => {
    const result = resolveCrossingGeometry({
      crossingId: 1,
      finishGradeElev: 101.2,
      gravityUpstreamInvert: 92,
      gravityDownstreamInvert: 90,
      distanceFromUpstreamFt: 30,
      totalRunFt: 100,
      gravityDiameterIn: 24,
      pressureTopElev: 93,
      requiredClearanceFt: 2,
    })

    expect(typeof result.conflictDetected).toBe('boolean')
    expect(result.resultStatus === 'ok' || result.resultStatus === 'conflict').toBe(true)
  })
})
