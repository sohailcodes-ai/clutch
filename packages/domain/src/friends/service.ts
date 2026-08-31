import { eq, and, or, desc, sql } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import { schema } from '@clutch/db'
import type { Database } from '@clutch/db'
import { AppError, ErrorCodes } from '@clutch/shared'
import { publishUserEvent } from '../realtime/pubsub.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FriendshipRow = typeof schema.friendships.$inferSelect

export type FriendView = {
  id: string
  userId: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  status: 'online' | 'offline' | 'queued' | 'in_match'
  friendshipSince: Date
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Normalize a pair so the canonical row is (min, max). */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

async function findFriendship(
  db: Database,
  userIdA: string,
  userIdB: string,
): Promise<FriendshipRow | undefined> {
  return db.query.friendships.findFirst({
    where: or(
      and(
        eq(schema.friendships.requesterId, userIdA),
        eq(schema.friendships.addresseeId, userIdB),
      ),
      and(
        eq(schema.friendships.requesterId, userIdB),
        eq(schema.friendships.addresseeId, userIdA),
      ),
    ),
  })
}

async function getFriendUserIds(
  db: Database,
  userId: string,
): Promise<string[]> {
  const rows = await db.query.friendships.findMany({
    where: and(
      eq(schema.friendships.status, 'accepted'),
      or(
        eq(schema.friendships.requesterId, userId),
        eq(schema.friendships.addresseeId, userId),
      ),
    ),
  })
  return rows.map((r) =>
    r.requesterId === userId ? r.addresseeId : r.requesterId,
  )
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Send a friend request from `requesterId` to the user identified by `handle`.
 */
export async function sendFriendRequest(
  db: Database,
  redis: Redis,
  requesterId: string,
  handle: string,
): Promise<FriendshipRow> {
  // Resolve target user
  const target = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.handle, handle),
  })
  if (!target) throw new AppError(ErrorCodes.NOT_FOUND, 'Player not found', 404)

  if (target.userId === requesterId) {
    throw new AppError(ErrorCodes.SELF_ACTION, 'Cannot send friend request to yourself', 400)
  }

  // Check existing friendship
  const existing = await findFriendship(db, requesterId, target.userId)
  if (existing) {
    if (existing.status === 'accepted') {
      throw new AppError(ErrorCodes.ALREADY_FRIENDS, 'Already friends', 409)
    }
    if (existing.status === 'pending') {
      throw new AppError(ErrorCodes.FRIEND_REQUEST_PENDING, 'Friend request already pending', 409)
    }
    // If declined/expired, allow re-request — update the existing row
    const [updated] = await db
      .update(schema.friendships)
      .set({
        requesterId: requesterId,
        addresseeId: target.userId,
        status: 'pending',
        acceptedAt: null,
        createdAt: new Date(),
      })
      .where(eq(schema.friendships.id, existing.id))
      .returning()
    return updated!
  }

  // Create new friendship row (actual requester / addressee)
  const [created] = await db
    .insert(schema.friendships)
    .values({
      requesterId: requesterId,
      addresseeId: target.userId,
      status: 'pending',
    })
    .returning()

  // Notify the addressee via realtime
  const senderProfile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, requesterId),
  })
  await publishUserEvent(redis, target.userId, {
    type: 'friend.request',
    payload: {
      friendshipId: created.id,
      from: {
        userId: requesterId,
        handle: senderProfile?.handle ?? null,
        displayName: senderProfile?.displayName ?? null,
      },
    },
  })

  return created!
}

/**
 * Accept a pending friend request.
 * Only the addressee (target) may accept.
 */
export async function acceptFriendRequest(
  db: Database,
  redis: Redis,
  userId: string,
  requesterId: string,
): Promise<FriendshipRow> {
  const friendship = await findFriendship(db, userId, requesterId)
  if (!friendship) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Friend request not found', 404)
  }
  if (friendship.status !== 'pending') {
    throw new AppError(ErrorCodes.CONFLICT, 'Friend request is not pending', 409)
  }
  // Only the addressee can accept
  if (friendship.addresseeId !== userId) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Only the recipient can accept', 403)
  }

  const [updated] = await db
    .update(schema.friendships)
    .set({ status: 'accepted', acceptedAt: new Date() })
    .where(eq(schema.friendships.id, friendship.id))
    .returning()

  // Notify requester
  await publishUserEvent(redis, friendship.requesterId, {
    type: 'friend.accepted',
    payload: { friendshipId: friendship.id, by: userId },
  })

  return updated!
}

/**
 * Decline a pending friend request.
 */
export async function declineFriendRequest(
  db: Database,
  userId: string,
  requesterId: string,
): Promise<FriendshipRow> {
  const friendship = await findFriendship(db, userId, requesterId)
  if (!friendship) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Friend request not found', 404)
  }
  if (friendship.status !== 'pending') {
    throw new AppError(ErrorCodes.CONFLICT, 'Friend request is not pending', 409)
  }
  if (friendship.addresseeId !== userId) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Only the recipient can decline', 403)
  }

  const [updated] = await db
    .update(schema.friendships)
    .set({ status: 'declined' })
    .where(eq(schema.friendships.id, friendship.id))
    .returning()

  return updated!
}

/**
 * Remove an existing friendship (unfriend).
 */
export async function removeFriend(
  db: Database,
  redis: Redis,
  userId: string,
  friendUserId: string,
): Promise<void> {
  const friendship = await findFriendship(db, userId, friendUserId)
  if (!friendship || friendship.status !== 'accepted') {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Friendship not found', 404)
  }

  await db
    .delete(schema.friendships)
    .where(eq(schema.friendships.id, friendship.id))

  // Notify the other party
  const otherUserId = friendship.requesterId === userId
    ? friendship.addresseeId
    : friendship.requesterId
  await publishUserEvent(redis, otherUserId, {
    type: 'friend.removed',
    payload: { by: userId },
  })
}

/**
 * List all accepted friends with their online status.
 */
export async function listFriends(
  db: Database,
  redis: Redis,
  userId: string,
): Promise<FriendView[]> {
  const friendIds = await getFriendUserIds(db, userId)
  if (friendIds.length === 0) return []

  const profiles = await db.query.userProfiles.findMany({
    where: or(
      ...friendIds.map((id) => eq(schema.userProfiles.userId, id)),
    ),
  })

  // Batch presence lookups
  const presenceKeys = friendIds.map((id) => `presence:${id}`)
  const presenceRaw = presenceKeys.length > 0
    ? await redis.mget(...presenceKeys)
    : []

  const presenceMap = new Map<string, { matchId?: string; at: number }>()
  friendIds.forEach((id, i) => {
    const raw = presenceRaw[i]
    if (raw) {
      try {
        presenceMap.set(id, JSON.parse(raw) as { matchId?: string; at: number })
      } catch { /* ignore */ }
    }
  })

  const now = Date.now()
  return profiles.map((p) => {
    const pres = presenceMap.get(p.userId)
    let status: FriendView['status'] = 'offline'
    if (pres && now - pres.at < 30_000) {
      status = pres.matchId ? 'in_match' : 'online'
    }
    return {
      id: p.userId,
      userId: p.userId,
      handle: p.handle,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      status,
      friendshipSince: new Date(), // placeholder, we can join if needed
    }
  })
}

/**
 * List pending friend requests (incoming and outgoing).
 */
export async function listFriendRequests(
  db: Database,
  userId: string,
): Promise<{
  incoming: (FriendshipRow & { requesterHandle: string; requesterDisplayName: string | null })[]
  outgoing: (FriendshipRow & { addresseeHandle: string; addresseeDisplayName: string | null })[]
}> {
  const incoming = await db.query.friendships.findMany({
    where: and(
      eq(schema.friendships.addresseeId, userId),
      eq(schema.friendships.status, 'pending'),
    ),
    orderBy: desc(schema.friendships.createdAt),
  })

  const outgoing = await db.query.friendships.findMany({
    where: and(
      eq(schema.friendships.requesterId, userId),
      eq(schema.friendships.status, 'pending'),
    ),
    orderBy: desc(schema.friendships.createdAt),
  })

  // Hydrate handles
  const allUserIds = [
    ...incoming.map((r) => r.requesterId),
    ...outgoing.map((r) => r.addresseeId),
  ]
  const profiles = allUserIds.length > 0
    ? await db.query.userProfiles.findMany({
        where: or(...allUserIds.map((id) => eq(schema.userProfiles.userId, id))),
      })
    : []
  const profileMap = new Map(profiles.map((p) => [p.userId, p]))

  return {
    incoming: incoming.map((r) => ({
      ...r,
      requesterHandle: profileMap.get(r.requesterId)?.handle ?? 'unknown',
      requesterDisplayName: profileMap.get(r.requesterId)?.displayName ?? null,
    })),
    outgoing: outgoing.map((r) => ({
      ...r,
      addresseeHandle: profileMap.get(r.addresseeId)?.handle ?? 'unknown',
      addresseeDisplayName: profileMap.get(r.addresseeId)?.displayName ?? null,
    })),
  }
}

/**
 * Check if two users are friends.
 */
export async function areFriends(
  db: Database,
  userIdA: string,
  userIdB: string,
): Promise<boolean> {
  const friendship = await findFriendship(db, userIdA, userIdB)
  return friendship?.status === 'accepted'
}

/**
 * Get presence for a single user (ephemeral, Redis-backed).
 */
export async function getUserPresence(
  redis: Redis,
  userId: string,
): Promise<'online' | 'offline' | 'queued' | 'in_match'> {
  const raw = await redis.get(`presence:${userId}`)
  if (!raw) return 'offline'
  try {
    const pres = JSON.parse(raw) as { matchId?: string; at: number }
    if (Date.now() - pres.at > 30_000) return 'offline'
    return pres.matchId ? 'in_match' : 'online'
  } catch {
    return 'offline'
  }
}
