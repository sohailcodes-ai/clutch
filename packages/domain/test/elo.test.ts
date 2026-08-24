import { describe, expect, it } from 'vitest'
import {
  calculateRatingDelta,
  expectedScore,
  getKFactor,
  scoreFromResult,
} from '../src/rating/elo.js'

describe('getKFactor', () => {
  it('uses K=40 during placement matches', () => {
    expect(getKFactor(0, 5, 1000)).toBe(40)
    expect(getKFactor(2, 1, 1000)).toBe(40)
  })

  it('uses K=32 for early games after placement', () => {
    expect(getKFactor(10, 0, 1200)).toBe(32)
  })

  it('uses K=16 above 2400', () => {
    expect(getKFactor(50, 0, 2500)).toBe(16)
  })

  it('uses K=24 otherwise', () => {
    expect(getKFactor(50, 0, 1800)).toBe(24)
  })
})

describe('expectedScore', () => {
  it('is 0.5 for equal ratings', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5)
  })

  it('favours the higher-rated player', () => {
    expect(expectedScore(1400, 1000)).toBeGreaterThan(0.5)
    expect(expectedScore(1000, 1400)).toBeLessThan(0.5)
  })

  it('is symmetric around 0.5', () => {
    const a = expectedScore(1200, 1500)
    const b = expectedScore(1500, 1200)
    expect(a + b).toBeCloseTo(1)
  })
})

describe('calculateRatingDelta', () => {
  it('rewards a win against an equal opponent', () => {
    const r = calculateRatingDelta(1000, 1000, 1, 50, 0)
    expect(r.delta).toBeGreaterThan(0)
    expect(r.after).toBe(1000 + r.delta)
  })

  it('punishes a loss to an equal opponent symmetrically', () => {
    const win = calculateRatingDelta(1000, 1000, 1, 50, 0)
    const loss = calculateRatingDelta(1000, 1000, 0, 50, 0)
    expect(loss.delta).toBe(-win.delta)
  })

  it('never drops below the rating floor', () => {
    const r = calculateRatingDelta(105, 3000, 0, 50, 0)
    expect(r.after).toBeGreaterThanOrEqual(100)
    // The reported delta must equal after - before so the ledger stays consistent.
    expect(105 + r.delta).toBe(r.after)
  })

  it('draw against equal opponent yields ~zero delta', () => {
    const r = calculateRatingDelta(1000, 1000, 0.5, 50, 0)
    expect(Math.abs(r.delta)).toBeLessThanOrEqual(1)
  })

  it('beating a much stronger player yields a large gain', () => {
    const upset = calculateRatingDelta(1000, 1600, 1, 50, 0)
    const even = calculateRatingDelta(1000, 1000, 1, 50, 0)
    expect(upset.delta).toBeGreaterThan(even.delta)
  })
})

describe('scoreFromResult', () => {
  it('maps results to Elo scores', () => {
    expect(scoreFromResult('win')).toBe(1)
    expect(scoreFromResult('draw')).toBe(0.5)
    expect(scoreFromResult('loss')).toBe(0)
    expect(scoreFromResult('forfeit')).toBe(0)
    expect(scoreFromResult('no_result')).toBe(0)
  })
})
