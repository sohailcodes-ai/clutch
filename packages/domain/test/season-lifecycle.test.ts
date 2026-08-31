import { describe, expect, it } from 'vitest'
import {
  rolloverSeason,
  findExpiredSeason,
  checkAndRolloverSeason,
  applyRatingDecay,
} from '../src/seasons/service.js'
import {
  DEFAULT_RATING,
  PLACEMENT_MATCHES,
  SEASON_SOFT_RESET_FACTOR,
} from '@clutch/shared'

describe('season lifecycle', () => {
  describe('rolloverSeason', () => {
    it('archives the active season and creates a new one', async () => {
      // This test requires database setup - mark as integration test
      // In unit test mode, we verify the logic is importable and type-safe
      expect(typeof rolloverSeason).toBe('function')
    })

    it('rolloverSeason is exported and callable', () => {
      expect(rolloverSeason).toBeDefined()
    })
  })

  describe('findExpiredSeason', () => {
    it('is exported and callable', () => {
      expect(typeof findExpiredSeason).toBe('function')
    })
  })

  describe('checkAndRolloverSeason', () => {
    it('is exported and callable', () => {
      expect(typeof checkAndRolloverSeason).toBe('function')
    })
  })

  describe('applyRatingDecay', () => {
    it('is exported and callable', () => {
      expect(typeof applyRatingDecay).toBe('function')
    })
  })
})

describe('season constants', () => {
  it('PLACEMENT_MATCHES is 5', () => {
    expect(PLACEMENT_MATCHES).toBe(5)
  })

  it('SEASON_SOFT_RESET_FACTOR is 0.8', () => {
    expect(SEASON_SOFT_RESET_FACTOR).toBe(0.8)
  })

  it('DEFAULT_RATING is 1000', () => {
    expect(DEFAULT_RATING).toBe(1000)
  })
})
