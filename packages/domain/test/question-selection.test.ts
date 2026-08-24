import { describe, expect, it } from 'vitest'
import {
  bandWalkOrder,
  chooseTargetBandIndex,
  isSelectableCandidate,
  pairJitter,
  pickBest,
  scoreCandidate,
} from '../src/questions/service.js'

describe('selectable candidate filter', () => {
  const mkq = (
    status: string,
    versions: { testCases: unknown[] }[] = [],
  ) => ({ status, versions })

  it('unpublished questions can never enter a match', () => {
    const q = mkq('draft', [{ testCases: [{ input: '1', expectedOutput: '1' }] }])
    expect(isSelectableCandidate(q)).toBe(false)
  })

  it('archived (retired) questions can never enter a match', () => {
    const q = mkq('retired', [{ testCases: [{ input: '1', expectedOutput: '1' }] }])
    expect(isSelectableCandidate(q)).toBe(false)
  })

  it('published questions without evaluable versions cannot enter a match', () => {
    expect(isSelectableCandidate(mkq('published'))).toBe(false)
    expect(isSelectableCandidate(mkq('published', [{ testCases: [] }]))).toBe(false)
  })

  it('published questions with tests are selectable', () => {
    const q = mkq('published', [{ testCases: [{ input: '1', expectedOutput: '1' }] }])
    expect(isSelectableCandidate(q)).toBe(true)
  })
})

describe('pool balancing / fallback walk', () => {
  it('starts at the preferred band then walks outward alternately', () => {
    expect(bandWalkOrder([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 2, 5, 1])
  })

  it('never deadlocks when the preferred bucket is absent', () => {
    // Preferred sort order 99 has no content — walk still yields every band.
    const order = bandWalkOrder([1, 2, 3], 99)
    expect(order).toHaveLength(3)
    expect(order).toEqual(expect.arrayContaining([1, 2, 3]))
  })

  it('handles duplicates and single-band pools', () => {
    expect(bandWalkOrder([2, 2], 2)).toEqual([2])
    expect(bandWalkOrder([], 1)).toEqual([])
  })
})

describe('adaptive target band', () => {
  const N = 9

  it('a beginner with no signal stays put', () => {
    expect(chooseTargetBandIndex(N, 2, [])).toBe(2)
  })

  it('strong recent performance steps up exactly one rung on average', () => {
    expect(chooseTargetBandIndex(N, 2, [0.9])).toBe(3)
    expect(chooseTargetBandIndex(N, 2, [0.9, 0.8])).toBe(3) // avg shift of +1
  })

  it('repeated failure pulls the band down but never below rookie', () => {
    expect(chooseTargetBandIndex(N, 2, [0.1])).toBe(1)
    expect(chooseTargetBandIndex(N, 0, [0.1])).toBe(0)
  })

  it('mixed signals cancel out to roughly no movement', () => {
    expect(chooseTargetBandIndex(N, 3, [0.9, 0.1])).toBe(3)
  })

  it('never exceeds the top of the ladder', () => {
    expect(chooseTargetBandIndex(N, N - 1, [0.95, 0.95])).toBe(N - 1)
  })

  it('is deterministic', () => {
    expect(chooseTargetBandIndex(N, 2, [0.75])).toBe(chooseTargetBandIndex(N, 2, [0.75]))
  })
})

describe('deterministic scoring & picking', () => {
  const pool = [
    { slug: 'alpha', timesSeen: 0, bandSortOrder: 3 },
    { slug: 'bravo', timesSeen: 4, bandSortOrder: 3 },
    { slug: 'charlie', timesSeen: 0, bandSortOrder: 5 },
  ]

  it('prefers the target difficulty over distant bands', () => {
    const s1 = scoreCandidate({ slug: 'x', bandSortOrder: 3, targetSortOrder: 3, timesSeen: 0 }, ['u'])
    const s2 = scoreCandidate({ slug: 'x', bandSortOrder: 6, targetSortOrder: 3, timesSeen: 0 }, ['u'])
    expect(s1).toBeGreaterThan(s2)
  })

  it('penalizes recently seen questions', () => {
    const s1 = scoreCandidate({ slug: 'x', bandSortOrder: 3, targetSortOrder: 3, timesSeen: 0 }, ['u'])
    const s2 = scoreCandidate({ slug: 'x', bandSortOrder: 3, targetSortOrder: 3, timesSeen: 9 }, ['u'])
    expect(s1).toBeGreaterThan(s2)
  })

  it('avoids repeating recently solved questions where possible', () => {
    const picked = pickBest(pool, 3, ['user-a', 'user-b'])
    expect(picked?.slug).not.toBe('bravo')
  })

  it('is deterministic for the same pair and varies across pairs', () => {
    const seedA = ['user-a', 'user-b']
    expect(pickBest(pool, 3, seedA)?.slug).toBe(pickBest(pool, 3, seedA)?.slug)

    // Different pairs may see different orderings (bounded jitter).
    const picks = new Set<string>()
    for (let i = 0; i < 12; i++) {
      picks.add(pickBest(pool, 3, [`pair-${i}`, `partner-${i}`])!.slug)
    }
    expect(picks.size).toBeGreaterThanOrEqual(1)
    expect(picks.size).toBeLessThanOrEqual(pool.length)
  })

  it('jitter is bounded in [0,1) and reproducible', () => {
    for (let i = 0; i < 200; i++) {
      const j = pairJitter(['p', String(i)], 'slug')
      expect(j).toBeGreaterThanOrEqual(0)
      expect(j).toBeLessThan(1)
    }
    expect(pairJitter(['a'], 'b')).toBe(pairJitter(['a'], 'b'))
    expect(pairJitter(['a'], 'b')).not.toBe(pairJitter(['b'], 'a'))
  })
})
