import { z } from 'zod'

export const sendChallengeSchema = z.object({
  handle: z.string().min(3).max(24),
  stackId: z.string().min(1).max(32),
  difficultyId: z.string().min(1).max(32).optional(),
})

export const challengeIdParamSchema = z.object({
  challengeId: z.string().uuid(),
})

export const challengeUserIdParamSchema = z.object({
  userId: z.string().uuid(),
})

export const listChallengesQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'declined', 'expired', 'cancelled', 'match_created']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
})
