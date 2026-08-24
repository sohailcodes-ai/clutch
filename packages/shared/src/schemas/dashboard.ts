import { z } from 'zod'
import { COMPETITIVE_STATUSES } from '../constants.js'

/**
 * Dashboard / PlayerCard DTO contracts. These describe the SHAPE the API
 * guarantees to players; serialization happens in the domain layer and never
 * includes email, session, security or internal identifiers.
 */
export const competitiveStatusSchema = z.enum(COMPETITIVE_STATUSES)

export const playerCardSchema = z.object({
  handle: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  equippedTitle: z
    .object({ code: z.string(), name: z.string(), rarity: z.string() })
    .nullable(),
  /** Server-authoritative competitive state — never inferred client-side. */
  competitiveStatus: competitiveStatusSchema,
  placementMatchesRequired: z.number().int().min(0),
  placementMatchesCompleted: z.number().int().min(0),
  placementRemaining: z.number().int().min(0),
  /** Null while unranked: no fake rating/tier/rank may be displayed. */
  bestRating: z.number().int().min(0),
  bestStackId: z.string().nullable(),
  tierId: z.string().nullable(),
  globalRank: z.number().int().min(1).nullable(),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  draws: z.number().int().min(0),
  gamesPlayed: z.number().int().min(0),
  peakRating: z.number().int().min(0),
  winRate: z.number().min(0).max(1),
})
export type PlayerCard = z.infer<typeof playerCardSchema>

export const recentMatchCardSchema = z.object({
  matchPublicId: z.string(),
  opponentHandle: z.string().nullable(),
  opponentAvatarUrl: z.string().nullable(),
  result: z.enum(['win', 'loss', 'draw', 'forfeit', 'no_result']),
  ratingDelta: z.number().int().nullable(),
  stackId: z.string(),
  difficultyId: z.string(),
  durationSec: z.number().int().nullable(),
  resolvedAt: z.string().nullable(),
  ranked: z.boolean(),
})
export type RecentMatchCard = z.infer<typeof recentMatchCardSchema>

/**
 * Pure sanitizer for recent-match rows. Given a raw composite it returns only
 * the whitelisted public fields — private data (source code, hidden tests,
 * moderation flags, internal ids) can never leak because it is dropped here.
 */
export function sanitizeRecentMatch(input: {
  matchPublicId: string
  opponentHandle: string | null
  opponentAvatarUrl: string | null
  result: 'win' | 'loss' | 'draw' | 'forfeit' | 'no_result'
  ratingDelta: number | null
  stackId: string
  difficultyId: string
  durationSec: number | null
  resolvedAt: Date | null
  ranked: boolean
}): RecentMatchCard {
  return {
    matchPublicId: input.matchPublicId,
    opponentHandle: input.opponentHandle,
    opponentAvatarUrl: input.opponentAvatarUrl,
    result: input.result,
    ratingDelta: input.ratingDelta,
    stackId: input.stackId,
    difficultyId: input.difficultyId,
    durationSec: input.durationSec,
    resolvedAt: input.resolvedAt ? input.resolvedAt.toISOString() : null,
    ranked: input.ranked,
  }
}
