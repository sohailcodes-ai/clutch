import { randomBytes } from 'node:crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '@clutch/db'
import { schema } from '@clutch/db'
import {
  AppError,
  DEFAULT_RATING,
  ErrorCodes,
  ROOM_LIMITS,
  type CreateRoomInput,
  type UpdateRoomInput,
} from '@clutch/shared'
import type { Redis } from 'ioredis'
import { selectQuestionForMatch } from '../questions/service.js'
import { appendMatchEvent } from '../match/events.js'
import { publishUserEvent, publishRoomEvent } from '../realtime/pubsub.js'
import { userHasActiveMatch } from '../match/lifecycle.js'

/**
 * Custom competitive rooms. All permissions, capacity and access control are
 * enforced server-side; join codes for private rooms are generated here and
 * never listed by public endpoints.
 */

function generateRoomPublicId(): string {
  return `RM-${randomBytes(4).toString('hex').toUpperCase()}`
}

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function generateJoinCode(): string {
  const bytes = randomBytes(ROOM_LIMITS.JOIN_CODE_LENGTH)
  let code = ''
  for (let i = 0; i < ROOM_LIMITS.JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[bytes[i]! % JOIN_CODE_ALPHABET.length]
  }
  return code
}

export async function createRoom(db: Database, redis: Redis, hostUserId: string, input: CreateRoomInput) {
  const stack = await db.query.stacks.findFirst({ where: eq(schema.stacks.id, input.stackId) })
  if (!stack || !stack.isActive) {
    throw new AppError(ErrorCodes.VALIDATION, 'Unknown or inactive stack', 400)
  }
  if (input.difficultyId) {
    const band = await db.query.difficultyBands.findFirst({
      where: eq(schema.difficultyBands.id, input.difficultyId),
    })
    if (!band) throw new AppError(ErrorCodes.VALIDATION, 'Unknown difficulty level', 400)
  }

  // Bound how many open lobbies one account can host (spam guard).
  const openCountRow = await db
    .select({ openCount: sql<number>`COUNT(*)` })
    .from(schema.rooms)
    .where(and(eq(schema.rooms.hostUserId, hostUserId), eq(schema.rooms.status, 'open')))
  if (Number(openCountRow[0]?.openCount ?? 0) >= ROOM_LIMITS.MAX_OPEN_ROOMS_PER_HOST) {
    throw new AppError(ErrorCodes.CONFLICT, 'Too many open rooms', 409)
  }

  const room = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.rooms)
      .values({
        publicId: generateRoomPublicId(),
        name: input.name,
        description: input.description ?? null,
        hostUserId,
        stackId: input.stackId,
        difficultyId: input.difficultyId,
        maxPlayers: input.maxPlayers,
        isPublic: input.isPublic,
        ranked: input.ranked,
        timeLimitSec: input.timeLimitSec,
        questionSelectionMode: input.questionSelectionMode,
        joinCode: input.isPublic ? null : generateJoinCode(),
      })
      .returning()
    if (!created) throw new AppError(ErrorCodes.INTERNAL, 'Failed to create room', 500)

    await tx.insert(schema.roomParticipants).values({
      roomId: created.id,
      userId: hostUserId,
      role: 'host',
    })
    return created
  })

  // Publish AFTER transaction commit
  await publishRoomEvent(redis, room.id, {
    type: 'room.created',
    actorUserId: hostUserId,
    payload: { roomId: room.id, publicId: room.publicId, name: room.name, stackId: room.stackId },
  })

  return room
}

export async function updateRoom(
  db: Database,
  redis: Redis,
  roomId: string,
  requesterUserId: string,
  input: UpdateRoomInput,
) {
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) })
  if (!room) throw new AppError(ErrorCodes.NOT_FOUND, 'Room not found', 404)
  if (room.hostUserId !== requesterUserId) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Only the host can update room settings', 403)
  }
  if (room.status !== 'open') {
    throw new AppError(ErrorCodes.CONFLICT, 'Cannot update a room that is not open', 409)
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (input.name !== undefined) updates.name = input.name
  if (input.description !== undefined) updates.description = input.description
  if (input.difficultyId !== undefined) updates.difficultyId = input.difficultyId
  if (input.maxPlayers !== undefined) updates.maxPlayers = input.maxPlayers
  if (input.ranked !== undefined) updates.ranked = input.ranked
  if (input.timeLimitSec !== undefined) updates.timeLimitSec = input.timeLimitSec
  if (input.questionSelectionMode !== undefined) updates.questionSelectionMode = input.questionSelectionMode

  await db.update(schema.rooms).set(updates).where(eq(schema.rooms.id, roomId))

  await publishRoomEvent(redis, roomId, {
    type: 'room.updated',
    actorUserId: requesterUserId,
    payload: { roomId, updates: Object.keys(updates).filter((k) => k !== 'updatedAt') },
  })

  return { updated: true }
}

export async function joinRoom(
  db: Database,
  redis: Redis,
  roomId: string,
  userId: string,
  joinCode?: string,
) {
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) })
  if (!room) throw new AppError(ErrorCodes.NOT_FOUND, 'Room not found', 404)
  if (room.status !== 'open') {
    throw new AppError(ErrorCodes.MATCH_NOT_ACTIVE, 'Room is not accepting players', 409)
  }

  const existing = await db.query.roomParticipants.findFirst({
    where: and(
      eq(schema.roomParticipants.roomId, roomId),
      eq(schema.roomParticipants.userId, userId),
      eq(schema.roomParticipants.status, 'active'),
    ),
  })
  if (existing) return { room, joined: false }

  // Private rooms require the exact server-issued code.
  if (!room.isPublic) {
    if (!joinCode || room.joinCode === null || joinCode !== room.joinCode) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Invalid room access code', 403)
    }
  }

  const countRow = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.roomParticipants)
    .where(and(eq(schema.roomParticipants.roomId, roomId), eq(schema.roomParticipants.status, 'active')))
  if (Number(countRow[0]?.count ?? 0) >= room.maxPlayers) {
    throw new AppError(ErrorCodes.CONFLICT, 'Room is full', 409)
  }

  await db.insert(schema.roomParticipants).values({ roomId, userId, role: 'player' }).onConflictDoNothing()

  // Look up handle for event payload
  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  })

  await publishRoomEvent(redis, roomId, {
    type: 'room.joined',
    actorUserId: userId,
    payload: { roomId, userId, handle: profile?.handle ?? null },
  })

  return { room, joined: true }
}

export async function leaveRoom(db: Database, redis: Redis, roomId: string, userId: string) {
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) })
  if (!room) throw new AppError(ErrorCodes.NOT_FOUND, 'Room not found', 404)

  const member = await db.query.roomParticipants.findFirst({
    where: and(eq(schema.roomParticipants.roomId, roomId), eq(schema.roomParticipants.userId, userId)),
  })

  if (member) {
    // Mark as left rather than deleting (preserves history)
    await db
      .update(schema.roomParticipants)
      .set({ status: 'left' })
      .where(eq(schema.roomParticipants.id, member.id))
  }

  const wasHost = room.hostUserId === userId

  // A host abandoning an open lobby closes it so it disappears from lists.
  if (wasHost && room.status === 'open') {
    await db.update(schema.rooms).set({ status: 'closed', cancelledAt: new Date() }).where(eq(schema.rooms.id, roomId))
  }

  // If host left but room is still open, transfer host to earliest joiner
  if (wasHost && room.status === 'open' && member) {
    const nextHost = await db.query.roomParticipants.findFirst({
      where: and(
        eq(schema.roomParticipants.roomId, roomId),
        eq(schema.roomParticipants.status, 'active'),
      ),
      orderBy: (r, { asc }) => asc(r.joinedAt),
    })
    if (nextHost) {
      await db
        .update(schema.rooms)
        .set({ hostUserId: nextHost.userId, updatedAt: new Date() })
        .where(eq(schema.rooms.id, roomId))
      await db
        .update(schema.roomParticipants)
        .set({ role: 'host' })
        .where(eq(schema.roomParticipants.id, nextHost.id))
    }
  }

  if (wasHost && room.status === 'open') {
    // Host left an open room — room is now cancelled
    await publishRoomEvent(redis, roomId, {
      type: 'room.cancelled',
      actorUserId: userId,
      payload: { roomId },
    })
  } else if (member) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.userId, userId),
    })
    await publishRoomEvent(redis, roomId, {
      type: 'room.left',
      actorUserId: userId,
      payload: { roomId, userId, handle: profile?.handle ?? null },
    })
  }

  return { left: member != null }
}

export async function setRoomReady(db: Database, redis: Redis, roomId: string, userId: string, ready: boolean) {
  const member = await db.query.roomParticipants.findFirst({
    where: and(
      eq(schema.roomParticipants.roomId, roomId),
      eq(schema.roomParticipants.userId, userId),
      eq(schema.roomParticipants.status, 'active'),
    ),
  })
  if (!member) throw new AppError(ErrorCodes.FORBIDDEN, 'Not a room participant', 403)

  await db
    .update(schema.roomParticipants)
    .set({ readyAt: ready ? new Date() : null })
    .where(eq(schema.roomParticipants.id, member.id))

  await publishRoomEvent(redis, roomId, {
    type: ready ? 'room.ready' : 'room.unready',
    actorUserId: userId,
    payload: { roomId, userId },
  })

  return { ready }
}

export async function removeRoomParticipant(
  db: Database,
  redis: Redis,
  roomId: string,
  hostUserId: string,
  targetUserId: string,
) {
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) })
  if (!room) throw new AppError(ErrorCodes.NOT_FOUND, 'Room not found', 404)
  if (room.hostUserId !== hostUserId) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Only the host can remove participants', 403)
  }
  if (hostUserId === targetUserId) {
    throw new AppError(ErrorCodes.VALIDATION, 'Host cannot remove themselves', 400)
  }

  await db
    .update(schema.roomParticipants)
    .set({ status: 'removed' })
    .where(
      and(
        eq(schema.roomParticipants.roomId, roomId),
        eq(schema.roomParticipants.userId, targetUserId),
      ),
    )

  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, targetUserId),
  })

  await publishRoomEvent(redis, roomId, {
    type: 'room.left',
    actorUserId: hostUserId,
    payload: { roomId, userId: targetUserId, handle: profile?.handle ?? null, reason: 'kicked' },
  })

  return { removed: true }
}

export async function lockRoom(db: Database, redis: Redis, roomId: string, hostUserId: string) {
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) })
  if (!room) throw new AppError(ErrorCodes.NOT_FOUND, 'Room not found', 404)
  if (room.hostUserId !== hostUserId) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Only the host can lock the room', 403)
  }
  if (room.status !== 'open') {
    throw new AppError(ErrorCodes.CONFLICT, 'Room is not open', 409)
  }

  await db
    .update(schema.rooms)
    .set({ lockedAt: new Date(), isPublic: false, updatedAt: new Date() })
    .where(eq(schema.rooms.id, roomId))

  await publishRoomEvent(redis, roomId, {
    type: 'room.locked',
    actorUserId: hostUserId,
    payload: { roomId },
  })

  return { locked: true }
}

export async function cancelRoom(db: Database, redis: Redis, roomId: string, requesterUserId: string) {
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) })
  if (!room) throw new AppError(ErrorCodes.NOT_FOUND, 'Room not found', 404)
  if (room.hostUserId !== requesterUserId) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Only the host can cancel the room', 403)
  }
  if (room.status === 'closed') {
    throw new AppError(ErrorCodes.CONFLICT, 'Room is already closed', 409)
  }

  await db
    .update(schema.rooms)
    .set({ status: 'closed', cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.rooms.id, roomId))

  await publishRoomEvent(redis, roomId, {
    type: 'room.cancelled',
    actorUserId: requesterUserId,
    payload: { roomId },
  })

  return { cancelled: true }
}

/** Sanitized room detail — exposes handles/avatars only, never join codes of
 *  rooms you do not host, never emails or internal identifiers. */
export async function getRoomDetail(db: Database, roomId: string, viewerUserId?: string) {
  const room = await db.query.rooms.findFirst({
    where: eq(schema.rooms.id, roomId),
    with: {
      stack: true,
      difficulty: true,
      participants: {
        where: eq(schema.roomParticipants.status, 'active'),
        with: { user: { with: { profile: true } } },
      },
    },
  })
  if (!room) return null

  const isHost = viewerUserId === room.hostUserId
  return {
    id: room.id,
    publicId: room.publicId,
    name: room.name,
    description: room.description,
    hostHandle: room.participants.find((p) => p.userId === room.hostUserId)?.user.profile?.handle ?? null,
    stackId: room.stackId,
    stackName: room.stack.name,
    difficultyId: room.difficultyId,
    difficultyLabel: room.difficulty?.id ?? null,
    maxPlayers: room.maxPlayers,
    isPublic: room.isPublic,
    ranked: room.ranked,
    timeLimitSec: room.timeLimitSec,
    questionSelectionMode: room.questionSelectionMode,
    status: room.status,
    lockedAt: room.lockedAt?.toISOString() ?? null,
    startedAt: room.startedAt?.toISOString() ?? null,
    finishedAt: room.finishedAt?.toISOString() ?? null,
    createdAt: room.createdAt.toISOString(),
    /** Join code is ONLY ever visible to the hosting user. */
    joinCode: isHost ? room.joinCode : undefined,
    players: room.participants.map((p) => ({
      handle: p.user.profile?.handle ?? null,
      displayName: p.user.profile?.displayName ?? null,
      avatarUrl: p.user.profile?.avatarUrl ?? null,
      isHost: p.userId === room.hostUserId,
      role: p.role,
      readyAt: p.readyAt?.toISOString() ?? null,
      joinedAt: p.joinedAt.toISOString(),
    })),
  }
}

export async function listOpenRooms(db: Database, limit = 20, offset = 0) {
  const rows = await db.query.rooms.findMany({
    where: and(eq(schema.rooms.status, 'open'), eq(schema.rooms.isPublic, true)),
    with: {
      stack: true,
      difficulty: true,
      participants: { where: eq(schema.roomParticipants.status, 'active'), columns: { userId: true } },
    },
    orderBy: (r, { desc }) => desc(r.createdAt),
    limit,
    offset,
  })

  return rows.map((room) => ({
    id: room.id,
    publicId: room.publicId,
    name: room.name,
    description: room.description,
    stackId: room.stackId,
    stackName: room.stack.name,
    difficultyId: room.difficultyId,
    difficultyLabel: room.difficulty?.id ?? null,
    ranked: room.ranked,
    playerCount: room.participants.length,
    maxPlayers: room.maxPlayers,
    createdAt: room.createdAt.toISOString(),
  }))
}

/**
 * Starts matches from a room lobby using the EXISTING match pipeline.
 * Supports both 1v1 duels and multi-player rooms (generates multiple matches).
 * Question selection, match creation and resolution are shared with ranked
 * matchmaking. Unranked rooms produce matches that never touch ELO.
 */
export async function startRoomMatch(
  db: Database,
  redis: import('ioredis').Redis,
  seasonId: string,
  roomId: string,
  requesterUserId: string,
) {
  const room = await db.query.rooms.findFirst({
    where: eq(schema.rooms.id, roomId),
    with: { participants: true },
  })
  if (!room) throw new AppError(ErrorCodes.NOT_FOUND, 'Room not found', 404)
  if (room.status !== 'open') {
    throw new AppError(ErrorCodes.MATCH_NOT_ACTIVE, 'Room already started', 409)
  }

  const member = room.participants.find((p) => p.userId === requesterUserId && p.status === 'active')
  if (!member) throw new AppError(ErrorCodes.FORBIDDEN, 'Not a room participant', 403)

  const activeParticipants = room.participants.filter((p) => p.status === 'active')
  const readyMembers = activeParticipants
    .filter((p) => p.readyAt !== null)
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
  if (readyMembers.length < 2) {
    throw new AppError(ErrorCodes.VALIDATION, 'Need at least two ready players', 400)
  }

  // Check no one is in an active match
  const activeChecks = await Promise.all(
    readyMembers.map((p) => userHasActiveMatch(db, p.userId)),
  )
  if (activeChecks.some(Boolean)) {
    throw new AppError(ErrorCodes.ALREADY_IN_MATCH, 'A player is already in an active match', 409)
  }

  const matchParticipantIds: string[] = []

  if (readyMembers.length === 2) {
    // Simple 1v1 duel
    const [first, second] = [readyMembers[0]!, readyMembers[1]!]
    const match = await createDuelMatch(db, redis, seasonId, room, [first.userId, second.userId])
    matchParticipantIds.push(first.userId, second.userId)

    // Publish room.started once (room transitions to in_progress inside createDuelMatch)
    await publishRoomEvent(redis, roomId, {
      type: 'room.started',
      actorUserId: requesterUserId,
      payload: { roomId, matchCount: 1 },
    })
    await publishRoomEvent(redis, roomId, {
      type: 'room.match_created',
      actorUserId: requesterUserId,
      payload: { roomId, matchId: match.id, publicId: match.publicId },
    })

    return { matches: [{ id: match.id, publicId: match.publicId }], totalMatches: 1 }
  }

  // Multi-player: generate multiple 1v1 matches from ready participants
  const matches: { id: string; publicId: string }[] = []
  for (let i = 0; i < readyMembers.length - 1; i += 2) {
    const a = readyMembers[i]!
    const b = readyMembers[i + 1]
    if (b) {
      const match = await createDuelMatch(db, redis, seasonId, room, [a.userId, b.userId])
      matches.push({ id: match.id, publicId: match.publicId })
      matchParticipantIds.push(a.userId, b.userId)

      await publishRoomEvent(redis, roomId, {
        type: 'room.match_created',
        actorUserId: requesterUserId,
        payload: { roomId, matchId: match.id, publicId: match.publicId, slotA: a.userId, slotB: b.userId },
      })
    }
  }

  // Publish room.started once after all matches are created
  await publishRoomEvent(redis, roomId, {
    type: 'room.started',
    actorUserId: requesterUserId,
    payload: { roomId, matchCount: matches.length },
  })

  return { matches, totalMatches: matches.length }
}

async function createDuelMatch(
  db: Database,
  redis: import('ioredis').Redis,
  seasonId: string,
  room: { id: string; stackId: string; difficultyId: string | null; timeLimitSec: number; ranked: boolean },
  userIds: [string, string],
) {
  const ratings = await db.query.userStackRatings.findMany({
    where: and(
      inArray(schema.userStackRatings.userId, userIds),
      eq(schema.userStackRatings.stackId, room.stackId),
    ),
  })
  const ratingOf = (userId: string) =>
    ratings.find((r) => r.userId === userId)?.rating ?? DEFAULT_RATING

  const selected = await selectQuestionForMatch(
    db,
    room.stackId,
    (ratingOf(userIds[0]) + ratingOf(userIds[1])) / 2,
    userIds,
    { preferredDifficultyId: room.difficultyId },
  )
  if (!selected) {
    throw new AppError(ErrorCodes.VALIDATION, 'No evaluable question available for this stack', 503)
  }

  const match = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.matches)
      .values({
        publicId: `CL-${randomBytes(4).toString('hex').toUpperCase()}`,
        seasonId,
        stackId: room.stackId,
        questionVersionId: selected.version.id,
        difficultyId: selected.difficultyId,
        status: 'matched',
        timeLimitSec: room.timeLimitSec,
        ranked: room.ranked,
        roomId: room.id,
      })
      .returning()
    if (!created) throw new AppError(ErrorCodes.INTERNAL, 'Failed to create match', 500)

    await tx.insert(schema.matchParticipants).values([
      { matchId: created.id, userId: userIds[0], slot: 1, ratingBefore: ratingOf(userIds[0]) },
      { matchId: created.id, userId: userIds[1], slot: 2, ratingBefore: ratingOf(userIds[1]) },
    ])

    await appendMatchEvent(tx, {
      matchId: created.id,
      eventType: 'match.matched',
      payload: { userIds, source: 'room', roomId: room.id },
    })

    await tx.update(schema.rooms).set({ status: 'in_progress', startedAt: new Date(), updatedAt: new Date() }).where(eq(schema.rooms.id, room.id))

    return created
  })

  const questionMeta = {
    title: selected.question.title,
    promptMd: selected.version.promptMd,
    starterCode: selected.version.starterCode,
    timeLimitSec: match.timeLimitSec,
  }
  await publishUserEvent(redis, userIds[0], {
    type: 'match.found',
    matchId: match.id,
    payload: { matchId: match.id, publicId: match.publicId, opponentUserId: userIds[1], questionMeta },
  })
  await publishUserEvent(redis, userIds[1], {
    type: 'match.found',
    matchId: match.id,
    payload: { matchId: match.id, publicId: match.publicId, opponentUserId: userIds[0], questionMeta },
  })

  return match
}

/**
 * Complete a room after all its matches have resolved.
 * Called by the worker after match resolution when the room has matches.
 */
export async function completeRoomIfFinished(
  db: Database,
  redis: import('ioredis').Redis,
  roomId: string,
): Promise<boolean> {
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) })
  if (!room || room.status !== 'in_progress') return false

  // Check if any room matches are still active
  const activeMatches = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.roomId, roomId),
        sql`status NOT IN ('resolved', 'draw', 'cancelled')`,
      ),
    )

  if (Number(activeMatches[0]?.count ?? 0) > 0) return false

  await db
    .update(schema.rooms)
    .set({ status: 'closed', finishedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.rooms.id, roomId))

  await publishRoomEvent(redis, roomId, {
    type: 'room.finished',
    payload: { roomId },
  })

  return true
}
