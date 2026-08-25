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

export async function setPresence(redis: Redis, userId: string, matchId?: string) {
  const key = `presence:${userId}`
  await redis.set(key, JSON.stringify({ matchId, at: Date.now() }), 'EX', 30)
}

export async function getPresence(redis: Redis, userId: string) {
  const raw = await redis.get(`presence:${userId}`)
  return raw ? (JSON.parse(raw) as { matchId?: string; at: number }) : null
}
