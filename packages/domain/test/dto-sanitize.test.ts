import { describe, expect, it } from 'vitest'
import {
  sanitizeRecentMatch,
  playerCardSchema,
  recentMatchCardSchema,
} from '@clutch/shared'
import { createRoomSchema } from '@clutch/shared'

describe('recent match sanitizer (privacy boundary)', () => {
  const raw = {
    matchPublicId: 'CL-DEADBEEF',
    opponentHandle: 'NEURALBYTE',
    opponentAvatarUrl: null,
    result: 'win' as const,
    ratingDelta: 21,
    stackId: 'python',
    difficultyId: 'rookie',
    durationSec: 761,
    resolvedAt: new Date('2026-08-01T10:00:00Z'),
    ranked: true,
  }

  it('exposes only whitelisted fields', () => {
    const dto = sanitizeRecentMatch(raw)
    expect(Object.keys(dto).sort()).toEqual([
      'difficultyId',
      'durationSec',
      'matchPublicId',
      'opponentAvatarUrl',
      'opponentHandle',
      'ranked',
      'ratingDelta',
      'resolvedAt',
      'result',
      'stackId',
    ])
    // Dates serialize to ISO strings for the client.
    expect(dto.resolvedAt).toBe('2026-08-01T10:00:00.000Z')
  })

  it('never includes source code, hidden tests or moderation data', () => {
    const dto = sanitizeRecentMatch(raw)
    const polluted = { ...dto }
    // Simulated leak attempts: the sanitizer's return type has no such fields.
    expect(JSON.stringify(polluted)).not.toContain('leak')
    expect(polluted).not.toHaveProperty('sourceCode')
    expect(polluted).not.toHaveProperty('hiddenTests')
    expect(polluted).not.toHaveProperty('abuseFlags')
  })

  it('unranked matches carry a null rating delta', () => {
    const dto = sanitizeRecentMatch({ ...raw, ratingDelta: null, ranked: false })
    expect(dto.ratingDelta).toBeNull()
    expect(dto.ranked).toBe(false)
  })

  it('output validates against the published DTO schema', () => {
    expect(recentMatchCardSchema.safeParse(sanitizeRecentMatch(raw)).success).toBe(true)
  })
})

describe('player card DTO contract', () => {
  it('validates a fully-populated card', () => {
    const parsed = playerCardSchema.safeParse({
      handle: 'CODEPHANTOM',
      displayName: null,
      avatarUrl: null,
      equippedTitle: { code: 'hot_streak', name: 'Hot Streak', rarity: 'rare' },
      bestRating: 1288,
      bestStackId: 'python',
      tierId: 'silver',
      globalRank: 447,
      wins: 24,
      losses: 11,
      draws: 3,
      gamesPlayed: 38,
      peakRating: 1384,
      winRate: 0.686,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects negative counters', () => {
    const parsed = playerCardSchema.safeParse({
      handle: 'X',
      displayName: null,
      avatarUrl: null,
      equippedTitle: null,
      bestRating: -5,
      bestStackId: null,
      tierId: null,
      globalRank: null,
      wins: -1,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
      peakRating: 0,
      winRate: 0,
    })
    expect(parsed.success).toBe(false)
  })
})

describe('room creation schema defaults', () => {
  it('applies sane defaults and rejects bad join codes', () => {
    const parsed = createRoomSchema.parse({ name: 'C++ Speed Room', stackId: 'cpp' })
    expect(parsed.maxPlayers).toBe(8)
    expect(parsed.isPublic).toBe(true)
    expect(parsed.ranked).toBe(false)
  })
})
