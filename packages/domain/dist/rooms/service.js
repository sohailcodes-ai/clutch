import { randomBytes } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { schema } from '@clutch/db';
import { AppError, DEFAULT_RATING, ErrorCodes, ROOM_LIMITS, } from '@clutch/shared';
import { selectQuestionForMatch } from '../questions/service.js';
import { appendMatchEvent } from '../match/events.js';
import { publishUserEvent } from '../realtime/pubsub.js';
import { userHasActiveMatch } from '../match/lifecycle.js';
/**
 * Custom competitive rooms. All permissions, capacity and access control are
 * enforced server-side; join codes for private rooms are generated here and
 * never listed by public endpoints.
 */
function generateRoomPublicId() {
    return `RM-${randomBytes(4).toString('hex').toUpperCase()}`;
}
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateJoinCode() {
    const bytes = randomBytes(ROOM_LIMITS.JOIN_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < ROOM_LIMITS.JOIN_CODE_LENGTH; i++) {
        code += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
    }
    return code;
}
export async function createRoom(db, hostUserId, input) {
    const stack = await db.query.stacks.findFirst({ where: eq(schema.stacks.id, input.stackId) });
    if (!stack || !stack.isActive) {
        throw new AppError(ErrorCodes.VALIDATION, 'Unknown or inactive stack', 400);
    }
    if (input.difficultyId) {
        const band = await db.query.difficultyBands.findFirst({
            where: eq(schema.difficultyBands.id, input.difficultyId),
        });
        if (!band)
            throw new AppError(ErrorCodes.VALIDATION, 'Unknown difficulty level', 400);
    }
    // Bound how many open lobbies one account can host (spam guard).
    const openCountRow = await db
        .select({ openCount: sql `COUNT(*)` })
        .from(schema.rooms)
        .where(and(eq(schema.rooms.hostUserId, hostUserId), eq(schema.rooms.status, 'open')));
    if (Number(openCountRow[0]?.openCount ?? 0) >= ROOM_LIMITS.MAX_OPEN_ROOMS_PER_HOST) {
        throw new AppError(ErrorCodes.CONFLICT, 'Too many open rooms', 409);
    }
    return db.transaction(async (tx) => {
        const [room] = await tx
            .insert(schema.rooms)
            .values({
            publicId: generateRoomPublicId(),
            name: input.name,
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
            .returning();
        if (!room)
            throw new AppError(ErrorCodes.INTERNAL, 'Failed to create room', 500);
        await tx.insert(schema.roomParticipants).values({ roomId: room.id, userId: hostUserId });
        return room;
    });
}
export async function joinRoom(db, roomId, userId, joinCode) {
    const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) });
    if (!room)
        throw new AppError(ErrorCodes.NOT_FOUND, 'Room not found', 404);
    if (room.status !== 'open') {
        throw new AppError(ErrorCodes.MATCH_NOT_ACTIVE, 'Room is not accepting players', 409);
    }
    const existing = await db.query.roomParticipants.findFirst({
        where: and(eq(schema.roomParticipants.roomId, roomId), eq(schema.roomParticipants.userId, userId)),
    });
    if (existing)
        return { room, joined: false };
    // Private rooms require the exact server-issued code.
    if (!room.isPublic) {
        if (!joinCode || room.joinCode === null || joinCode !== room.joinCode) {
            throw new AppError(ErrorCodes.FORBIDDEN, 'Invalid room access code', 403);
        }
    }
    const countRow = await db
        .select({ count: sql `COUNT(*)` })
        .from(schema.roomParticipants)
        .where(eq(schema.roomParticipants.roomId, roomId));
    if (Number(countRow[0]?.count ?? 0) >= room.maxPlayers) {
        throw new AppError(ErrorCodes.CONFLICT, 'Room is full', 409);
    }
    await db.insert(schema.roomParticipants).values({ roomId, userId }).onConflictDoNothing();
    return { room, joined: true };
}
export async function leaveRoom(db, roomId, userId) {
    const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) });
    if (!room)
        throw new AppError(ErrorCodes.NOT_FOUND, 'Room not found', 404);
    const deleted = await db
        .delete(schema.roomParticipants)
        .where(and(eq(schema.roomParticipants.roomId, roomId), eq(schema.roomParticipants.userId, userId)))
        .returning();
    // A host abandoning an open lobby closes it so it disappears from lists.
    if (deleted.length > 0 && room.hostUserId === userId && room.status === 'open') {
        await db.update(schema.rooms).set({ status: 'closed' }).where(eq(schema.rooms.id, roomId));
    }
    return { left: deleted.length > 0 };
}
export async function setRoomReady(db, roomId, userId, ready) {
    const member = await db.query.roomParticipants.findFirst({
        where: and(eq(schema.roomParticipants.roomId, roomId), eq(schema.roomParticipants.userId, userId)),
    });
    if (!member)
        throw new AppError(ErrorCodes.FORBIDDEN, 'Not a room participant', 403);
    await db
        .update(schema.roomParticipants)
        .set({ readyAt: ready ? new Date() : null })
        .where(eq(schema.roomParticipants.id, member.id));
    return { ready };
}
/** Sanitized room detail — exposes handles/avatars only, never join codes of
 *  rooms you do not host, never emails or internal identifiers. */
export async function getRoomDetail(db, roomId, viewerUserId) {
    const room = await db.query.rooms.findFirst({
        where: eq(schema.rooms.id, roomId),
        with: {
            stack: true,
            difficulty: true,
            participants: { with: { user: { with: { profile: true } } } },
        },
    });
    if (!room)
        return null;
    const isHost = viewerUserId === room.hostUserId;
    return {
        id: room.id,
        publicId: room.publicId,
        name: room.name,
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
        createdAt: room.createdAt.toISOString(),
        /** Join code is ONLY ever visible to the hosting user. */
        joinCode: isHost ? room.joinCode : undefined,
        players: room.participants.map((p) => ({
            handle: p.user.profile?.handle ?? null,
            displayName: p.user.profile?.displayName ?? null,
            avatarUrl: p.user.profile?.avatarUrl ?? null,
            isHost: p.userId === room.hostUserId,
            readyAt: p.readyAt?.toISOString() ?? null,
            joinedAt: p.joinedAt.toISOString(),
        })),
    };
}
export async function listOpenRooms(db, limit = 20, offset = 0) {
    const rows = await db.query.rooms.findMany({
        where: and(eq(schema.rooms.status, 'open'), eq(schema.rooms.isPublic, true)),
        with: {
            stack: true,
            difficulty: true,
            participants: { columns: { userId: true } },
        },
        orderBy: (r, { desc }) => desc(r.createdAt),
        limit,
        offset,
    });
    return rows.map((room) => ({
        id: room.id,
        publicId: room.publicId,
        name: room.name,
        stackId: room.stackId,
        stackName: room.stack.name,
        difficultyId: room.difficultyId,
        difficultyLabel: room.difficulty?.id ?? null,
        ranked: room.ranked,
        playerCount: room.participants.length,
        maxPlayers: room.maxPlayers,
    }));
}
/**
 * Starts a real duel from a room lobby using the EXISTING match pipeline:
 * question selection, match creation and resolution are shared with ranked
 * matchmaking. Unranked rooms produce matches that never touch ELO.
 */
export async function startRoomMatch(db, redis, seasonId, roomId, requesterUserId) {
    const room = await db.query.rooms.findFirst({
        where: eq(schema.rooms.id, roomId),
        with: { participants: true },
    });
    if (!room)
        throw new AppError(ErrorCodes.NOT_FOUND, 'Room not found', 404);
    if (room.status !== 'open') {
        throw new AppError(ErrorCodes.MATCH_NOT_ACTIVE, 'Room already started', 409);
    }
    const member = room.participants.find((p) => p.userId === requesterUserId);
    if (!member)
        throw new AppError(ErrorCodes.FORBIDDEN, 'Not a room participant', 403);
    const readyMembers = room.participants
        .filter((p) => p.readyAt !== null)
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    if (readyMembers.length < 2) {
        throw new AppError(ErrorCodes.VALIDATION, 'Need at least two ready players', 400);
    }
    const [first, second] = [readyMembers[0], readyMembers[1]];
    const activeRows = await Promise.all([
        userHasActiveMatch(db, first.userId),
        userHasActiveMatch(db, second.userId),
    ]);
    if (activeRows.some(Boolean)) {
        throw new AppError(ErrorCodes.ALREADY_IN_MATCH, 'A player is already in an active match', 409);
    }
    const ratings = await db.query.userStackRatings.findMany({
        where: and(inArray(schema.userStackRatings.userId, [first.userId, second.userId]), eq(schema.userStackRatings.stackId, room.stackId)),
    });
    const ratingOf = (userId) => ratings.find((r) => r.userId === userId)?.rating ?? DEFAULT_RATING;
    const selected = await selectQuestionForMatch(db, room.stackId, (ratingOf(first.userId) + ratingOf(second.userId)) / 2, [first.userId, second.userId], { preferredDifficultyId: room.difficultyId });
    if (!selected) {
        throw new AppError(ErrorCodes.VALIDATION, 'No evaluable question available for this stack', 503);
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
            .returning();
        if (!created)
            throw new AppError(ErrorCodes.INTERNAL, 'Failed to create match', 500);
        await tx.insert(schema.matchParticipants).values([
            { matchId: created.id, userId: first.userId, slot: 1, ratingBefore: ratingOf(first.userId) },
            { matchId: created.id, userId: second.userId, slot: 2, ratingBefore: ratingOf(second.userId) },
        ]);
        await appendMatchEvent(tx, {
            matchId: created.id,
            eventType: 'match.matched',
            payload: { userIds: [first.userId, second.userId], source: 'room', roomId: room.id },
        });
        await tx.update(schema.rooms).set({ status: 'in_progress', updatedAt: new Date() }).where(eq(schema.rooms.id, room.id));
        return created;
    });
    const questionMeta = {
        title: selected.question.title,
        promptMd: selected.version.promptMd,
        starterCode: selected.version.starterCode,
        timeLimitSec: match.timeLimitSec,
    };
    await publishUserEvent(redis, first.userId, {
        type: 'match.found',
        matchId: match.id,
        payload: { matchId: match.id, publicId: match.publicId, opponentUserId: second.userId, questionMeta },
    });
    await publishUserEvent(redis, second.userId, {
        type: 'match.found',
        matchId: match.id,
        payload: { matchId: match.id, publicId: match.publicId, opponentUserId: first.userId, questionMeta },
    });
    return match;
}
//# sourceMappingURL=service.js.map