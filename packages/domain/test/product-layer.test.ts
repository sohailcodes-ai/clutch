import { describe, expect, it } from 'vitest'
import { decideProgression, ladderIndex, type TopicSignal } from '../src/progression/service.js'
import { evaluateCriteria, isTitleCriteria, type CompetitiveFacts } from '../src/titles/service.js'
import { normalizedShingles, similarityScore } from '../src/match/resolution.js'

function signal(topic: string, attempts: number, solved: number): TopicSignal {
  return { topic, attempts, solved, failed: attempts - solved, accuracy: solved / attempts }
}

describe('ladderIndex', () => {
  it('maps band ids to ladder positions', () => {
    expect(ladderIndex('rookie')).toBe(0)
    expect(ladderIndex('clutch')).toBeGreaterThan(0)
    expect(ladderIndex('nonexistent')).toBe(-1)
  })
})

describe('decideProgression (deterministic)', () => {
  it('starts new players at rookie', () => {
    const d = decideProgression([], 1000)
    expect(d.targetBandId).toBe('rookie')
    expect(d.reason).toMatch(/Rookie/)
  })

  it('steps up after strong recent performance', () => {
    // rating 1000 -> beginner band; strong accuracy steps one rung up
    const d = decideProgression([signal('arrays', 10, 9)], 1000)
    expect(d.targetBandId).toBe(ladderIndex('beginner') + 1 >= 0 ? 'easy' : d.targetBandId)
    expect(d.strongTopics).toContain('arrays')
  })

  it('never exceeds the top of the ladder', () => {
    const d = decideProgression([signal('graphs', 20, 20)], 2500)
    expect(d.targetBandId).toBe('clutch')
  })

  it('flags weak topics for targeted practice', () => {
    const d = decideProgression(
      [signal('arrays', 10, 9), signal('graphs', 6, 1)],
      1300,
    )
    expect(d.weakTopics).toEqual(['graphs'])
    expect(d.strongTopics).toContain('arrays')
  })

  it('is deterministic across runs', () => {
    const s = [signal('strings', 5, 4), signal('dp', 8, 3)]
    expect(decideProgression(s, 1200)).toEqual(decideProgression(s, 1200))
  })

  it('ignores topics with too little signal', () => {
    const d = decideProgression([signal('loops', 1, 0)], 1000)
    expect(d.weakTopics).toHaveLength(0)
  })
})

describe('title criteria', () => {
  const facts: CompetitiveFacts = {
    wins: 12,
    losses: 3,
    draws: 2,
    matches: 27,
    peakRating: 2250,
    firstBloods: 4,
    currentWinStreak: 0,
    bestWinStreak: 6,
    uniqueSolved: 30,
    stacksWon: 2,
    difficultiesSolved: 4,
    globalRank: null,
    fastestWinMs: null,
    comebackWins: 0,
  }

  it('validates criteria shape strictly', () => {
    expect(isTitleCriteria({ type: 'wins', value: 5 })).toBe(true)
    expect(isTitleCriteria({ type: 'first_blood' })).toBe(true)
    expect(isTitleCriteria({ type: 'wins' })).toBe(false)
    expect(isTitleCriteria({ type: 'hack', value: 1 })).toBe(false)
    expect(isTitleCriteria(null)).toBe(false)
  })

  it('evaluates server-authoritative facts only', () => {
    expect(evaluateCriteria({ type: 'wins', value: 10 }, facts)).toBe(true)
    expect(evaluateCriteria({ type: 'wins', value: 50 }, facts)).toBe(false)
    expect(evaluateCriteria({ type: 'matches', value: 25 }, facts)).toBe(true)
    expect(evaluateCriteria({ type: 'rating', value: 2200 }, facts)).toBe(true)
    expect(evaluateCriteria({ type: 'rating', value: 2400 }, facts)).toBe(false)
    expect(evaluateCriteria({ type: 'first_blood' }, facts)).toBe(true)
    expect(evaluateCriteria({ type: 'draws', value: 5 }, facts)).toBe(false)
  })
})

describe('bounded similarity detection', () => {
  it('scores identical code as ~1', () => {
    const a = normalizedShingles('const x = compute(a, b);\nif (x > y) return x;')
    const b = normalizedShingles('const x=compute(a,b);\nif(x>y)returnx;')
    expect(similarityScore(a, b)).toBeGreaterThan(0.85)
  })

  it('scores unrelated code low', () => {
    const a = normalizedShingles('for i in range(n): print(i * factorial)')
    const b = normalizedShingles('SELECT name FROM users ORDER BY created_at DESC')
    expect(similarityScore(a, b)).toBeLessThan(0.3)
  })

  it('is bounded on adversarially huge inputs', () => {
    const huge = 'a'.repeat(500000) + ' b'.repeat(100000)
    const start = Date.now()
    const s = similarityScore(normalizedShingles(huge), normalizedShingles(huge + 'c'))
    const elapsed = Date.now() - start
    expect(s).toBeCloseTo(1)
    // Hard input cap keeps this well under any request budget.
    expect(elapsed).toBeLessThan(2000)
  })
})
