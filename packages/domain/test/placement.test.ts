import { describe, expect, it } from 'vitest'
import { PLACEMENT_MATCHES } from '@clutch/shared'
import {
  buildCompetitiveIdentity,
  competitiveStatusOf,
  placementMatchesCompleted,
  placementTargetShift,
  pairingInitialBand,
} from '../src/rating/placement.js'
import { expandedBand, ratingBucket } from '../src/matchmaking/service.js'
import {
  isEvaluationFailure,
  shouldVoidCompetitiveOutcome,
} from '../src/match/resolution.js'
import { calculateRatingDelta, getKFactor } from '../src/rating/elo.js'

describe('competitive status derivation', () => {
  it('a newly registered player starts UNRANKED', () => {
    const identity = buildCompetitiveIdentity({ placementRemaining: PLACEMENT_MATCHES })
    expect(identity.competitiveStatus).toBe('unranked')
    expect(identity.placementRemaining).toBe(PLACEMENT_MATCHES)
    expect(identity.placementMatchesCompleted).toBe(0)
    expect(identity.placementMatchesRequired).toBe(PLACEMENT_MATCHES)
  })

  it('mid-placement players stay UNRANKED with correct progress', () => {
    const identity = buildCompetitiveIdentity({ placementRemaining: 3 })
    expect(identity.competitiveStatus).toBe('unranked')
    expect(identity.placementMatchesCompleted).toBe(2)
  })

  it('placement completion transitions to RANKED', () => {
    const identity = buildCompetitiveIdentity({ placementRemaining: 0 })
    expect(identity.competitiveStatus).toBe('ranked')
    expect(identity.placementMatchesCompleted).toBe(PLACEMENT_MATCHES)
  })

  it('clamps nonsensical remaining values defensively', () => {
    expect(competitiveStatusOf(-1)).toBe('ranked')
    expect(competitiveStatusOf(99)).toBe('unranked')
    expect(placementMatchesCompleted(-5)).toBe(PLACEMENT_MATCHES)
    expect(placementMatchesCompleted(50)).toBe(0)
  })

  it('progress derives from REMAINING, not games played', () => {
    // Season rollovers reset placements but keep gamesPlayed — deriving
    // completed from gamesPlayed would double-count.
    expect(buildCompetitiveIdentity({ placementRemaining: 2 }).placementMatchesCompleted).toBe(3)
  })
})

describe('placement ELO calibration', () => {
  it('uses the high-urgency K factor throughout placement', () => {
    for (let remaining = 1; remaining <= PLACEMENT_MATCHES; remaining++) {
      expect(getKFactor(PLACEMENT_MATCHES - remaining, remaining, 1000)).toBe(40)
    }
  })

  it('drops to normal K factors once ranked', () => {
    expect(getKFactor(10, 0, 1200)).toBe(32)
  })

  it('an early result moves the rating but never locks it in', () => {
    // Match 1 vs an equal opponent: bounded movement, symmetric outcomes.
    const win = calculateRatingDelta(1000, 1000, 1, 0, PLACEMENT_MATCHES)
    const loss = calculateRatingDelta(1000, 1000, 0, 0, PLACEMENT_MATCHES)
    expect(win.delta).toBeGreaterThan(0)
    expect(loss.delta).toBeLessThan(0)
    expect(Math.abs(win.delta)).toBeLessThan(100)
    expect(win.delta).toBe(-loss.delta)
    // The existing ELO formula stays the source of truth.
    expect(win.after).toBe(1000 + win.delta)
  })
})

describe('placement matchmaking policy', () => {
  it('starts wider for pairs involving a placement player', () => {
    const ranked = pairingInitialBand(false)
    const placement = pairingInitialBand(true)
    expect(placement).toBeGreaterThan(ranked)
  })

  it('placement band is broader initially…', () => {
    const bucket = ratingBucket(1000)
    const ranked = expandedBand(bucket, 0)
    const placement = expandedBand(bucket, 0, pairingInitialBand(true))
    expect(placement.max - placement.min).toBeGreaterThan(ranked.max - ranked.min)
  })

  it('…but stays bounded — never a random opponent from the whole pool', () => {
    const bucket = ratingBucket(1000)
    const instant = expandedBand(bucket, 0, pairingInitialBand(true))
    const hourLater = expandedBand(bucket, 3600, pairingInitialBand(true))
    // Expansion caps at QUEUE_BAND_MAX regardless of starting width.
    expect(hourLater.min).toBe(bucket - 400)
    expect(hourLater.max).toBe(bucket + 400 + 50)
    expect(instant.min).toBeGreaterThan(bucket - 400)
  })

  it('expands gradually while waiting', () => {
    const bucket = ratingBucket(1000)
    const early = expandedBand(bucket, 0, pairingInitialBand(true))
    const later = expandedBand(bucket, 60, pairingInitialBand(true))
    expect(later.max - later.min).toBeGreaterThan(early.max - early.min)
  })

  it('leaves ranked-ranked pairing behavior untouched', () => {
    const band = expandedBand(1000, 0)
    expect(band.min).toBe(950)
    expect(band.max).toBe(1100)
  })
})

describe('question difficulty during placement', () => {
  it('early placement matches bias toward accessible bands', () => {
    expect(placementTargetShift(PLACEMENT_MATCHES)).toBe(2)
    expect(placementTargetShift(4)).toBe(2)
  })

  it('later matches converge toward fully adaptive selection', () => {
    expect(placementTargetShift(3)).toBe(1)
    expect(placementTargetShift(2)).toBe(1)
    expect(placementTargetShift(1)).toBe(0)
  })

  it('ranked players get no bias', () => {
    expect(placementTargetShift(0)).toBe(0)
  })
})

describe('placement consumption integrity', () => {
  it('flags evaluation infrastructure failures', () => {
    expect(isEvaluationFailure('internal_error')).toBe(true)
    expect(isEvaluationFailure('accepted')).toBe(false)
    expect(isEvaluationFailure(null)).toBe(false)
  })

  it('a failed evaluation does NOT consume placement progress', () => {
    const results = [
      { finalSubmissionStatus: 'accepted' },
      { finalSubmissionStatus: 'internal_error' },
    ]
    expect(shouldVoidCompetitiveOutcome(results)).toBe(true)
  })

  it('an abandoned match with nothing judged does NOT consume placement', () => {
    const results = [{ finalSubmissionStatus: null }, { finalSubmissionStatus: null }]
    expect(shouldVoidCompetitiveOutcome(results)).toBe(true)
  })

  it('legitimate judged results DO count as placement matches', () => {
    expect(
      shouldVoidCompetitiveOutcome([
        { finalSubmissionStatus: 'accepted' },
        { finalSubmissionStatus: 'wrong_answer' },
      ]),
    ).toBe(false)
    expect(
      shouldVoidCompetitiveOutcome([
        { finalSubmissionStatus: 'time_limit' },
        { finalSubmissionStatus: 'accepted' },
      ]),
    ).toBe(false)
  })
})
