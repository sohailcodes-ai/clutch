import { describe, expect, it } from 'vitest'
import {
  EMPTY_FACTS,
  evaluateCriteria,
  isTitleCriteria,
  titleProgress,
  type CompetitiveFacts,
} from '../src/titles/service.js'

const base: CompetitiveFacts = { ...EMPTY_FACTS }

describe('title criteria vocabulary', () => {
  it('accepts every supported shape and rejects malformed ones', () => {
    expect(isTitleCriteria({ type: 'win_streak', value: 5 })).toBe(true)
    expect(isTitleCriteria({ type: 'unique_solved', value: 50 })).toBe(true)
    expect(isTitleCriteria({ type: 'stacks_won', value: 3 })).toBe(true)
    expect(isTitleCriteria({ type: 'difficulty_climb', value: 3 })).toBe(true)
    expect(isTitleCriteria({ type: 'top_rank', value: 100 })).toBe(true)
    expect(isTitleCriteria({ type: 'fast_win', value: 60000 })).toBe(true)
    expect(isTitleCriteria({ type: 'first_blood_fast', value: 60000 })).toBe(true)
    expect(isTitleCriteria({ type: 'comeback' })).toBe(true)
    expect(isTitleCriteria({ type: 'win_streak' })).toBe(false)
    expect(isTitleCriteria({ type: 'exploit', value: 1 })).toBe(false)
  })
})

describe('extended evaluation (deterministic, server-authoritative)', () => {
  it('streak titles use best streak, not current', () => {
    const facts: CompetitiveFacts = { ...base, bestWinStreak: 7, currentWinStreak: 2 }
    expect(evaluateCriteria({ type: 'win_streak', value: 5 }, facts)).toBe(true)
    expect(evaluateCriteria({ type: 'win_streak', value: 10 }, facts)).toBe(false)
  })

  it('solve/stack/climb counters work', () => {
    const facts: CompetitiveFacts = {
      ...base,
      uniqueSolved: 51,
      stacksWon: 3,
      difficultiesSolved: 4,
    }
    expect(evaluateCriteria({ type: 'unique_solved', value: 50 }, facts)).toBe(true)
    expect(evaluateCriteria({ type: 'stacks_won', value: 5 }, facts)).toBe(false)
    expect(evaluateCriteria({ type: 'difficulty_climb', value: 3 }, facts)).toBe(true)
  })

  it('rank titles require a rank observation', () => {
    expect(evaluateCriteria({ type: 'top_rank', value: 100 }, base)).toBe(false)
    expect(
      evaluateCriteria({ type: 'top_rank', value: 100 }, { ...base, globalRank: 87 }),
    ).toBe(true)
    expect(
      evaluateCriteria({ type: 'top_rank', value: 20 }, { ...base, globalRank: 87 }),
    ).toBe(false)
  })

  it('speed titles require an observed solve time', () => {
    expect(evaluateCriteria({ type: 'fast_win', value: 60000 }, base)).toBe(false)
    expect(
      evaluateCriteria({ type: 'fast_win', value: 60000 }, { ...base, fastestWinMs: 42000 }),
    ).toBe(true)
  })

  it('secret compound criteria are exact', () => {
    expect(evaluateCriteria({ type: 'comeback' }, { ...base, comebackWins: 1 })).toBe(true)
    expect(evaluateCriteria({ type: 'comeback' }, base)).toBe(false)
    expect(
      evaluateCriteria(
        { type: 'first_blood_fast', value: 60000 },
        { ...base, firstBloods: 1, fastestWinMs: 30000 },
      ),
    ).toBe(true)
    expect(
      evaluateCriteria(
        { type: 'first_blood_fast', value: 60000 },
        { ...base, firstBloods: 0, fastestWinMs: 30000 },
      ),
    ).toBe(false)
  })
})

describe('title progress', () => {
  it('reports bounded partial progress toward thresholds', () => {
    const p = titleProgress({ type: 'wins', value: 10 }, { ...base, wins: 4 })
    expect(p).toEqual({ current: 4, target: 10 })
    // Progress never exceeds the target once unlocked.
    expect(titleProgress({ type: 'wins', value: 10 }, { ...base, wins: 40 })).toEqual({
      current: 10,
      target: 10,
    })
  })

  it('returns null for boolean or unobserved criteria', () => {
    expect(titleProgress({ type: 'comeback' }, base)).toBeNull()
    expect(titleProgress({ type: 'top_rank', value: 100 }, base)).toBeNull()
  })

  it('is deterministic across runs', () => {
    const facts = { ...base, wins: 3 }
    expect(titleProgress({ type: 'wins', value: 5 }, facts)).toEqual(
      titleProgress({ type: 'wins', value: 5 }, facts),
    )
  })
})
