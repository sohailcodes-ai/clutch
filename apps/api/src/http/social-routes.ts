import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  AppError,
  ErrorCodes,
  sendFriendRequestSchema,
  sendChallengeSchema,
} from '@clutch/shared'
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  listFriends,
  listFriendRequests,
  sendChallenge,
  acceptChallenge,
  declineChallenge,
  cancelChallenge,
  listChallenges,
  expirePendingChallenges,
} from '@clutch/domain'
import { requireAuth } from '../middleware/auth.js'

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'Invalid request', 400)
  }
  return parsed.data
}

async function enforceRateLimit(
  request: { server: { redis: import('ioredis').Redis } },
  opts: { key: string; limit: number; windowSec: number },
) {
  const { checkRateLimit } = await import('@clutch/domain')
  const result = await checkRateLimit(
    request.server.redis,
    opts.key,
    opts.limit,
    opts.windowSec,
  )
  if (!result.allowed) {
    throw new AppError(ErrorCodes.RATE_LIMITED, 'Too many requests', 429, true)
  }
}

/** Friends, challenges, and social endpoints. */
export async function registerSocialRoutes(app: import('fastify').FastifyInstance) {
  // -------------------------------------------------------------------------
  // Friends
  // -------------------------------------------------------------------------

  /**
   * POST /friends/request — Send a friend request
   */
  app.post('/friends/request', { preHandler: [requireAuth] }, async (request, reply) => {
    await enforceRateLimit(request, {
      key: `friend:request:${request.user!.id}`,
      limit: 10,
      windowSec: 60,
    })

    const input = parse(sendFriendRequestSchema, request.body)
    const friendship = await sendFriendRequest(
      request.server.db,
      request.server.redis,
      request.user!.id,
      input.handle,
    )
    void reply.code(201)
    return { friendship }
  })

  /**
   * POST /friends/:userId/accept — Accept a friend request
   */
  app.post('/friends/:userId/accept', { preHandler: [requireAuth] }, async (request) => {
    const { userId } = parse(z.object({ userId: z.string().uuid() }), request.params)
    const friendship = await acceptFriendRequest(
      request.server.db,
      request.server.redis,
      request.user!.id,
      userId,
    )
    return { friendship }
  })

  /**
   * POST /friends/:userId/decline — Decline a friend request
   */
  app.post('/friends/:userId/decline', { preHandler: [requireAuth] }, async (request) => {
    const { userId } = parse(z.object({ userId: z.string().uuid() }), request.params)
    const friendship = await declineFriendRequest(
      request.server.db,
      request.user!.id,
      userId,
    )
    return { friendship }
  })

  /**
   * DELETE /friends/:userId — Remove a friend
   */
  app.delete('/friends/:userId', { preHandler: [requireAuth] }, async (request) => {
    const { userId } = parse(z.object({ userId: z.string().uuid() }), request.params)
    await removeFriend(
      request.server.db,
      request.server.redis,
      request.user!.id,
      userId,
    )
    return { ok: true }
  })

  /**
   * GET /friends — List all accepted friends
   */
  app.get('/friends', { preHandler: [requireAuth] }, async (request) => {
    const friends = await listFriends(
      request.server.db,
      request.server.redis,
      request.user!.id,
    )
    return { friends }
  })

  /**
   * GET /friends/requests — List pending friend requests
   */
  app.get('/friends/requests', { preHandler: [requireAuth] }, async (request) => {
    const requests = await listFriendRequests(
      request.server.db,
      request.user!.id,
    )
    return requests
  })

  // -------------------------------------------------------------------------
  // Challenges
  // -------------------------------------------------------------------------

  /**
   * POST /challenges — Send a challenge to a friend
   */
  app.post('/challenges', { preHandler: [requireAuth] }, async (request, reply) => {
    await enforceRateLimit(request, {
      key: `challenge:create:${request.user!.id}`,
      limit: 10,
      windowSec: 60,
    })

    const input = parse(sendChallengeSchema, request.body)
    const challenge = await sendChallenge(
      request.server.db,
      request.server.redis,
      request.user!.id,
      input,
    )
    void reply.code(201)
    return { challenge }
  })

  /**
   * POST /challenges/:challengeId/accept — Accept a challenge
   */
  app.post('/challenges/:challengeId/accept', { preHandler: [requireAuth] }, async (request) => {
    const { challengeId } = parse(z.object({ challengeId: z.string().uuid() }), request.params)
    const result = await acceptChallenge(
      request.server.db,
      request.server.redis,
      request.user!.id,
      challengeId,
    )
    return result
  })

  /**
   * POST /challenges/:challengeId/decline — Decline a challenge
   */
  app.post('/challenges/:challengeId/decline', { preHandler: [requireAuth] }, async (request) => {
    const { challengeId } = parse(z.object({ challengeId: z.string().uuid() }), request.params)
    const challenge = await declineChallenge(
      request.server.db,
      request.server.redis,
      request.user!.id,
      challengeId,
    )
    return { challenge }
  })

  /**
   * POST /challenges/:challengeId/cancel — Cancel a challenge (challenger only)
   */
  app.post('/challenges/:challengeId/cancel', { preHandler: [requireAuth] }, async (request) => {
    const { challengeId } = parse(z.object({ challengeId: z.string().uuid() }), request.params)
    const challenge = await cancelChallenge(
      request.server.db,
      request.server.redis,
      request.user!.id,
      challengeId,
    )
    return { challenge }
  })

  /**
   * GET /challenges — List challenges for the current user
   */
  app.get('/challenges', { preHandler: [requireAuth] }, async (request) => {
    const query = parse(
      z.object({
        status: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).max(10000).default(0),
      }),
      request.query,
    )
    const challenges = await listChallenges(
      request.server.db,
      request.user!.id,
      query,
    )
    return { challenges }
  })

  /**
   * POST /challenges/sweep — Expire stale challenges (internal/cron)
   */
  app.post('/challenges/sweep', { preHandler: [requireAuth] }, async (request) => {
    const expired = await expirePendingChallenges(
      request.server.db,
      request.server.redis,
    )
    return { expired }
  })
}
