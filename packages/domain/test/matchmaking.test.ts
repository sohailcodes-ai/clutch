import { describe, expect, it } from 'vitest'
import { expandedBand, ratingBucket } from '../src/matchmaking/service.js'

describe('ratingBucket', () => {
  it('floors ratings into fixed buckets', () => {
    expect(ratingBucket(1000)).toBe(1000)
    expect(ratingBucket(1049)).toBe(1000)
    expect(ratingBucket(1050)).toBe(1050)
    expect(ratingBucket(999)).toBe(950)
  })
})

describe('expandedBand', () => {
  it('starts with the initial narrow band', () => {
    const band = expandedBand(1000, 0)
    expect(band.min).toBe(950)
    expect(band.max).toBe(1100)
  })

  it('widens by QUEUE_BAND_STEP every 10 seconds', () => {
    const b10 = expandedBand(1000, 10)
    expect(b10.max - b10.min).toBeGreaterThan(expandedBand(1000, 0).max - expandedBand(1000, 0).min)
  })

  it('never widens beyond QUEUE_BAND_MAX', () => {
    const huge = expandedBand(1000, 60 * 60)
    // min = bucket - maxDelta, max = bucket + maxDelta + band
    expect(huge.min).toBe(1000 - 400)
    expect(huge.max).toBe(1000 + 400 + 50)
  })

  it('a player inside the initial band is matchable immediately', () => {
    const band = expandedBand(ratingBucket(1010), 5)
    expect(1035).toBeGreaterThanOrEqual(band.min)
    expect(1035).toBeLessThanOrEqual(band.max)
  })

  it('a far-rated player is excluded until the band expands', () => {
    const early = expandedBand(ratingBucket(1000), 0)
    expect(1400).toBeGreaterThan(early.max)
    const late = expandedBand(ratingBucket(1000), 600)
    expect(1400).toBeLessThanOrEqual(late.max)
  })
})
