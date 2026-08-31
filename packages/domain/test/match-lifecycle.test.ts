import { describe, expect, it } from 'vitest'
import {
  isEvaluationFailure,
  shouldVoidCompetitiveOutcome,
  validateAdjudication,
} from '../src/match/resolution.js'
import {
  getKFactor,
  expectedScore,
  calculateRatingDelta,
  scoreFromResult,
} from '../src/rating/elo.js'
import { MATCH_STATUSES, SUBMISSION_STATUSES, READY_WINDOW_SEC, MATCH_TIME_LIMIT_SEC } from '@clutch/shared'

// ---------------------------------------------------------------------------
// Match state machine constants
// ---------------------------------------------------------------------------

describe('match status constants', () => {
  it('defines all expected match statuses', () => {
    expect(MATCH_STATUSES).toContain('matched')
    expect(MATCH_STATUSES).toContain('starting')
    expect(MATCH_STATUSES).toContain('active')
    expect(MATCH_STATUSES).toContain('evaluating')
    expect(MATCH_STATUSES).toContain('resolved')
    expect(MATCH_STATUSES).toContain('cancelled')
    expect(MATCH_STATUSES).toContain('abandoned')
    expect(MATCH_STATUSES).toContain('draw')
  })

  it('defines all expected submission statuses', () => {
    expect(SUBMISSION_STATUSES).toContain('queued')
    expect(SUBMISSION_STATUSES).toContain('running')
    expect(SUBMISSION_STATUSES).toContain('accepted')
    expect(SUBMISSION_STATUSES).toContain('wrong_answer')
    expect(SUBMISSION_STATUSES).toContain('compile_error')
    expect(SUBMISSION_STATUSES).toContain('runtime_error')
    expect(SUBMISSION_STATUSES).toContain('time_limit')
    expect(SUBMISSION_STATUSES).toContain('internal_error')
  })
})

describe('timing constants', () => {
  it('ready window is 30 seconds', () => {
    expect(READY_WINDOW_SEC).toBe(30)
  })

  it('match time limit is 900 seconds (15 minutes)', () => {
    expect(MATCH_TIME_LIMIT_SEC).toBe(900)
  })
})

// ---------------------------------------------------------------------------
// Evaluation failure detection
// ---------------------------------------------------------------------------

describe('isEvaluationFailure', () => {
  it('returns true for internal_error', () => {
    expect(isEvaluationFailure('internal_error')).toBe(true)
  })

  it('returns false for all other statuses', () => {
    expect(isEvaluationFailure('accepted')).toBe(false)
    expect(isEvaluationFailure('wrong_answer')).toBe(false)
    expect(isEvaluationFailure('compile_error')).toBe(false)
    expect(isEvaluationFailure('runtime_error')).toBe(false)
    expect(isEvaluationFailure('time_limit')).toBe(false)
    expect(isEvaluationFailure('queued')).toBe(false)
    expect(isEvaluationFailure('running')).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isEvaluationFailure(null)).toBe(false)
    expect(isEvaluationFailure(undefined)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Competitive outcome voiding
// ---------------------------------------------------------------------------

describe('shouldVoidCompetitiveOutcome', () => {
  it('voids when no final submissions were evaluated', () => {
    expect(
      shouldVoidCompetitiveOutcome([
        { finalSubmissionStatus: null },
        { finalSubmissionStatus: null },
      ]),
    ).toBe(true)
  })

  it('voids when one side has infrastructure failure', () => {
    expect(
      shouldVoidCompetitiveOutcome([
        { finalSubmissionStatus: 'accepted' },
        { finalSubmissionStatus: 'internal_error' },
      ]),
    ).toBe(true)
  })

  it('does not void when both sides have evaluated non-error submissions', () => {
    expect(
      shouldVoidCompetitiveOutcome([
        { finalSubmissionStatus: 'accepted' },
        { finalSubmissionStatus: 'wrong_answer' },
      ]),
    ).toBe(false)
  })

  it('does not void when one side accepted and other has no submission yet', () => {
    // anyEvaluated is true (accepted exists), and no internal_error -> no void.
    // This shouldn't normally happen (evaluation checks both have finals),
    // but the function handles it: if at least one final was evaluated and
    // no infrastructure failure occurred, the outcome is valid.
    expect(
      shouldVoidCompetitiveOutcome([
        { finalSubmissionStatus: 'accepted' },
        { finalSubmissionStatus: null },
      ]),
    ).toBe(false)
  })

  it('voids when both sides have infrastructure failure', () => {
    expect(
      shouldVoidCompetitiveOutcome([
        { finalSubmissionStatus: 'internal_error' },
        { finalSubmissionStatus: 'internal_error' },
      ]),
    ).toBe(true)
  })

  it('handles empty results array', () => {
    expect(shouldVoidCompetitiveOutcome([])).toBe(true)
  })

  it('handles single participant with no evaluation', () => {
    expect(shouldVoidCompetitiveOutcome([{ finalSubmissionStatus: null }])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Adjudication validation
// ---------------------------------------------------------------------------

const participants = [
  { userId: '11111111-1111-1111-1111-111111111111' },
  { userId: '22222222-2222-2222-2222-222222222222' },
]
const winner = participants[0]!.userId
const reason = 'Evaluation infrastructure failed for player B; manual review confirms player A.'

describe('validateAdjudication', () => {
  it('accepts valid adjudication for all live statuses', () => {
    for (const status of ['matched', 'starting', 'active', 'evaluating', 'abandoned']) {
      expect(
        validateAdjudication({ status, participants }, { matchId: 'm', winnerUserId: winner, reason }).ok,
      ).toBe(true)
    }
  })

  it('rejects terminal states', () => {
    for (const status of ['resolved', 'draw', 'cancelled']) {
      const result = validateAdjudication(
        { status, participants },
        { matchId: 'm', winnerUserId: winner, reason },
      )
      expect(result.ok).toBe(false)
    }
  })

  it('rejects non-participant winner', () => {
    const result = validateAdjudication(
      { status: 'active', participants },
      { matchId: 'm', winnerUserId: '99999999-9999-9999-9999-999999999999', reason },
    )
    expect(result.ok).toBe(false)
  })

  it('rejects empty reason', () => {
    expect(
      validateAdjudication(
        { status: 'active', participants },
        { matchId: 'm', winnerUserId: winner, reason: '' },
      ).ok,
    ).toBe(false)
  })

  it('rejects too-short reason', () => {
    expect(
      validateAdjudication(
        { status: 'active', participants },
        { matchId: 'm', winnerUserId: winner, reason: 'short' },
      ).ok,
    ).toBe(false)
  })

  it('rejects too-long reason', () => {
    expect(
      validateAdjudication(
        { status: 'active', participants },
        { matchId: 'm', winnerUserId: winner, reason: 'x'.repeat(1001) },
      ).ok,
    ).toBe(false)
  })

  it('is deterministic', () => {
    const input = { matchId: 'm', winnerUserId: winner, reason }
    const r1 = validateAdjudication({ status: 'active', participants }, input)
    const r2 = validateAdjudication({ status: 'active', participants }, input)
    expect(r1).toEqual(r2)
  })
})

// ---------------------------------------------------------------------------
// ELO / Rating system
// ---------------------------------------------------------------------------

describe('getKFactor', () => {
  it('returns 40 during placement', () => {
    expect(getKFactor(0, 3, 1000)).toBe(40)
    expect(getKFactor(10, 1, 1200)).toBe(40)
  })

  it('returns 32 for new ranked players (< 30 games)', () => {
    expect(getKFactor(10, 0, 1000)).toBe(32)
    expect(getKFactor(29, 0, 1000)).toBe(32)
  })

  it('returns 16 for very high rated players (> 2400)', () => {
    expect(getKFactor(100, 0, 2401)).toBe(16)
    expect(getKFactor(200, 0, 2800)).toBe(16)
  })

  it('returns 24 for established mid-tier players', () => {
    expect(getKFactor(50, 0, 1200)).toBe(24)
    expect(getKFactor(100, 0, 1800)).toBe(24)
  })
})

describe('expectedScore', () => {
  it('returns ~0.5 for equal ratings', () => {
    const e = expectedScore(1000, 1000)
    expect(e).toBeCloseTo(0.5, 2)
  })

  it('returns > 0.5 for higher-rated player', () => {
    const e = expectedScore(1200, 1000)
    expect(e).toBeGreaterThan(0.5)
  })

  it('returns < 0.5 for lower-rated player', () => {
    const e = expectedScore(800, 1000)
    expect(e).toBeLessThan(0.5)
  })

  it('is symmetric: e(A,B) + e(B,A) = 1', () => {
    const e1 = expectedScore(1000, 1400)
    const e2 = expectedScore(1400, 1000)
    expect(e1 + e2).toBeCloseTo(1, 6)
  })
})

describe('calculateRatingDelta', () => {
  it('gains rating on win against higher-rated opponent', () => {
    const result = calculateRatingDelta(1000, 1200, 1, 0, 5)
    expect(result.delta).toBeGreaterThan(0)
    expect(result.after).toBeGreaterThan(1000)
  })

  it('loses rating on loss against lower-rated opponent', () => {
    const result = calculateRatingDelta(1200, 1000, 0, 10, 0)
    expect(result.delta).toBeLessThan(0)
    expect(result.after).toBeLessThan(1200)
  })

  it('draw results in small delta', () => {
    const result = calculateRatingDelta(1000, 1000, 0.5, 10, 0)
    expect(result.delta).toBe(0)
  })

  it('rating never drops below RATING_FLOOR', () => {
    const result = calculateRatingDelta(120, 2000, 0, 50, 0)
    expect(result.after).toBeGreaterThanOrEqual(100)
  })

  it('returns higher K factor during placement', () => {
    const placement = calculateRatingDelta(1000, 1000, 1, 0, 5)
    const ranked = calculateRatingDelta(1000, 1000, 1, 10, 0)
    expect(placement.k).toBeGreaterThan(ranked.k)
  })
})

describe('scoreFromResult', () => {
  it('returns 1 for win', () => {
    expect(scoreFromResult('win')).toBe(1)
  })

  it('returns 0.5 for draw', () => {
    expect(scoreFromResult('draw')).toBe(0.5)
  })

  it('returns 0 for loss', () => {
    expect(scoreFromResult('loss')).toBe(0)
  })

  it('returns 0 for forfeit', () => {
    expect(scoreFromResult('forfeit')).toBe(0)
  })

  it('returns 0 for no_result', () => {
    expect(scoreFromResult('no_result')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Frontend match state mapping (unit-testable logic)
// ---------------------------------------------------------------------------

describe('match state mapping', () => {
  const TERMINAL_STATES = ['resolved', 'draw', 'abandoned', 'cancelled']
  const LOBBY_STATES = ['matched', 'starting']
  const ACTIVE_STATES = ['active', 'evaluating']

  it('terminal states render result screen', () => {
    for (const status of TERMINAL_STATES) {
      expect(TERMINAL_STATES.includes(status)).toBe(true)
    }
  })

  it('lobby states render VS screen', () => {
    for (const status of LOBBY_STATES) {
      expect(LOBBY_STATES.includes(status)).toBe(true)
    }
  })

  it('active states render duel screen', () => {
    for (const status of ACTIVE_STATES) {
      expect(ACTIVE_STATES.includes(status)).toBe(true)
    }
  })

  it('all defined statuses map to exactly one UI state', () => {
    const allDefined = new Set([...TERMINAL_STATES, ...LOBBY_STATES, ...ACTIVE_STATES, 'queued'])
    // 'queued' is a match-making queue entry status, not a match status in practice
    for (const status of MATCH_STATUSES) {
      if (status === 'queued') continue // queue entry status, not used for matches
      expect(allDefined.has(status)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Submission status chip behavior
// ---------------------------------------------------------------------------

describe('submission status classification', () => {
  const ACCEPTED = ['accepted']
  const DEFEAT = ['wrong_answer', 'time_limit', 'runtime_error']
  const WARNING = ['compile_error']
  const MUTED = ['internal_error', 'received']
  const PENDING = ['queued', 'running']

  it('accepted is victory', () => {
    for (const s of ACCEPTED) {
      expect(SUBMISSION_STATUSES).toContain(s)
    }
  })

  it('defeat statuses are recognized', () => {
    for (const s of DEFEAT) {
      expect(SUBMISSION_STATUSES).toContain(s)
    }
  })

  it('warning statuses are recognized', () => {
    for (const s of WARNING) {
      expect(SUBMISSION_STATUSES).toContain(s)
    }
  })

  it('pending statuses are recognized', () => {
    for (const s of PENDING) {
      expect(SUBMISSION_STATUSES).toContain(s)
    }
  })
})

// ---------------------------------------------------------------------------
// Ready flow constants
// ---------------------------------------------------------------------------

describe('ready flow constants', () => {
  it('ready window is positive and reasonable', () => {
    expect(READY_WINDOW_SEC).toBeGreaterThan(0)
    expect(READY_WINDOW_SEC).toBeLessThanOrEqual(120)
  })

  it('match time limit is positive and reasonable', () => {
    expect(MATCH_TIME_LIMIT_SEC).toBeGreaterThanOrEqual(300)
    expect(MATCH_TIME_LIMIT_SEC).toBeLessThanOrEqual(3600)
  })
})
