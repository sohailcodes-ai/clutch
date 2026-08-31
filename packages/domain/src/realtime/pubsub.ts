import type { Redis } from 'ioredis'

export function userChannel(userId: string) {
  return `user:${userId}`
}

export function matchChannel(matchId: string) {
  return `match:${matchId}`
}

export function roomChannel(roomId: string) {
  return `room:${roomId}`
}

export function tournamentChannel(tournamentId: string) {
  return `tournament:${tournamentId}`
}

export async function publishUserEvent(
  redis: Redis,
  userId: string,
  event: {
    type: string
    matchId?: string
    payload?: Record<string, unknown>
  },
) {
  const envelope = {
    type: event.type,
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    matchId: event.matchId,
    payload: event.payload ?? {},
  }
  await redis.publish(userChannel(userId), JSON.stringify(envelope))
}

export async function publishMatchEvent(
  redis: Redis,
  matchId: string,
  event: {
    type: string
    payload?: Record<string, unknown>
    actorUserId?: string
  },
) {
  const envelope = {
    type: event.type,
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    matchId,
    payload: event.payload ?? {},
  }
  await redis.publish(matchChannel(matchId), JSON.stringify(envelope))
}

export async function publishRoomEvent(
  redis: Redis,
  roomId: string,
  event: {
    type: string
    payload?: Record<string, unknown>
    actorUserId?: string
  },
) {
  const envelope = {
    type: event.type,
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    roomId,
    payload: event.payload ?? {},
  }
  await redis.publish(roomChannel(roomId), JSON.stringify(envelope))
}

export async function publishTournamentEvent(
  redis: Redis,
  tournamentId: string,
  event: {
    type: string
    payload?: Record<string, unknown>
    actorUserId?: string
  },
) {
  const envelope = {
    type: event.type,
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    tournamentId,
    payload: event.payload ?? {},
  }
  await redis.publish(tournamentChannel(tournamentId), JSON.stringify(envelope))
}

export async function setPresence(
  redis: Redis,
  userId: string,
  state: 'online' | 'queued' | 'in_match',
  matchId?: string,
) {
  const key = `presence:${userId}`
  const value = JSON.stringify({ state, matchId, at: Date.now() })
  await redis.set(key, value, 'EX', 30)
}

export async function getPresence(redis: Redis, userId: string) {
  const raw = await redis.get(`presence:${userId}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { state?: string; matchId?: string; at: number }
    // Backward compatibility: if no state field, derive from matchId
    const state = parsed.state ?? (parsed.matchId ? 'in_match' : 'online')
    return { state: state as 'online' | 'queued' | 'in_match', matchId: parsed.matchId, at: parsed.at }
  } catch {
    return null
  }
}

/**
 * Get presence for multiple users in a single pipeline.
 */
export async function getPresenceBatch(
  redis: Redis,
  userIds: string[],
): Promise<Map<string, { state: 'online' | 'queued' | 'in_match'; matchId?: string; at: number }>> {
  const result = new Map<string, { state: 'online' | 'queued' | 'in_match'; matchId?: string; at: number }>()
  if (userIds.length === 0) return result

  const keys = userIds.map((id) => `presence:${id}`)
  const rawValues = await redis.mget(...keys)
  const now = Date.now()

  userIds.forEach((id, i) => {
    const raw = rawValues[i]
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { state?: string; matchId?: string; at: number }
        if (now - parsed.at < 30_000) {
          const state = parsed.state ?? (parsed.matchId ? 'in_match' : 'online')
          result.set(id, { state: state as any, matchId: parsed.matchId, at: parsed.at })
        }
      } catch { /* ignore */ }
    }
  })

  return result
}

/**
 * Publish a presence update to all friends of a user.
 * This is a best-effort fanout; the caller should debounce.
 */
export async function publishPresenceToFriends(
  redis: Redis,
  userId: string,
  friendUserIds: string[],
  state: 'online' | 'queued' | 'in_match' | 'offline',
) {
  for (const friendId of friendUserIds) {
    await publishUserEvent(redis, friendId, {
      type: 'presence.updated',
      payload: { userId, state },
    })
  }
}
