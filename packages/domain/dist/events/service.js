import { and, eq, inArray, sql } from 'drizzle-orm';
import { schema } from '@clutch/db';
import { AppError, ErrorCodes, canRegisterForEvent, eventPhase, } from '@clutch/shared';
/**
 * Events: server-time-authoritative competitive windows. Clients never
 * compute phases or fake participation — everything below derives from
 * PostgreSQL rows and the API server clock.
 */
async function assertEventConfig(db, input) {
    if (input.endsAt <= input.startsAt) {
        throw new AppError(ErrorCodes.VALIDATION, 'Event end must be after start', 400);
    }
    const stacks = await db.query.stacks.findMany({
        where: inArray(schema.stacks.id, input.stackIds),
    });
    if (stacks.length !== input.stackIds.length) {
        throw new AppError(ErrorCodes.VALIDATION, 'Unknown stack in stackIds', 400);
    }
    const bands = await db.query.difficultyBands.findMany({
        where: inArray(schema.difficultyBands.id, input.allowedDifficultyIds),
    });
    if (bands.length !== input.allowedDifficultyIds.length) {
        throw new AppError(ErrorCodes.VALIDATION, 'Unknown difficulty level', 400);
    }
}
export async function createEvent(db, input) {
    await assertEventConfig(db, input);
    const titleIds = input.rewardTitleCodes.length
        ? (await db.query.titles.findMany({
            where: inArray(schema.titles.code, input.rewardTitleCodes),
            columns: { id: true },
        })).map((t) => t.id)
        : [];
    return db.transaction(async (tx) => {
        const [event] = await tx
            .insert(schema.events)
            .values({
            slug: input.slug,
            name: input.name,
            descriptionMd: input.descriptionMd ?? null,
            rulesMd: input.rulesMd ?? null,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            maxParticipants: input.maxParticipants,
            rewardTitleIds: titleIds,
            status: 'published',
        })
            .returning();
        if (!event)
            throw new AppError(ErrorCodes.INTERNAL, 'Failed to create event', 500);
        await tx
            .insert(schema.eventStacks)
            .values(input.stackIds.map((stackId) => ({ eventId: event.id, stackId })));
        await tx.insert(schema.eventDifficultyLevels).values(input.allowedDifficultyIds.map((difficultyId) => ({ eventId: event.id, difficultyId })));
        return event;
    });
}
/** Public listing with authoritative phase computed from server time. */
export async function listEvents(db, opts = {}) {
    const now = new Date();
    const rows = await db.query.events.findMany({
        where: eq(schema.events.status, 'published'),
        with: { stacks: { with: { stack: true } }, difficultyLevels: true },
        orderBy: (e, { asc }) => asc(e.startsAt),
        limit: opts.limit ?? 20,
        offset: opts.offset ?? 0,
    });
    return rows
        .map((event) => ({
        id: event.id,
        slug: event.slug,
        name: event.name,
        descriptionMd: event.descriptionMd,
        rulesMd: event.rulesMd,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        phase: eventPhase(now, event),
        maxParticipants: event.maxParticipants,
        stackIds: event.stacks.map((s) => s.stackId),
        difficultyIds: event.difficultyLevels.map((d) => d.difficultyId),
        serverTimeMs: now.getTime(),
    }))
        .filter((e) => (opts.phase && opts.phase !== 'all' ? e.phase === opts.phase : true));
}
export async function getEvent(db, slug) {
    const now = new Date();
    const event = await db.query.events.findFirst({
        where: eq(schema.events.slug, slug),
        with: { stacks: { with: { stack: true } }, difficultyLevels: true },
    });
    if (!event || event.status !== 'published')
        return null;
    const regCount = await db
        .select({ count: sql `COUNT(*)` })
        .from(schema.eventRegistrations)
        .where(eq(schema.eventRegistrations.eventId, event.id));
    return {
        id: event.id,
        slug: event.slug,
        name: event.name,
        descriptionMd: event.descriptionMd,
        rulesMd: event.rulesMd,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        phase: eventPhase(now, event),
        serverTimeMs: now.getTime(),
        maxParticipants: event.maxParticipants,
        registeredCount: Number(regCount[0]?.count ?? 0),
        stackIds: event.stacks.map((s) => s.stackId),
        difficultyIds: event.difficultyLevels.map((d) => d.difficultyId),
    };
}
export async function registerForEvent(db, slug, userId) {
    const now = new Date();
    const event = await db.query.events.findFirst({ where: eq(schema.events.slug, slug) });
    if (!event || event.status !== 'published') {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    }
    const window = canRegisterForEvent(now, event);
    if (!window.ok)
        throw new AppError(ErrorCodes.VALIDATION, window.reason, 409);
    const existing = await db.query.eventRegistrations.findFirst({
        where: and(eq(schema.eventRegistrations.eventId, event.id), eq(schema.eventRegistrations.userId, userId)),
    });
    if (existing)
        throw new AppError(ErrorCodes.CONFLICT, 'Already registered', 409);
    if (event.maxParticipants !== null) {
        const regCount = await db
            .select({ count: sql `COUNT(*)` })
            .from(schema.eventRegistrations)
            .where(eq(schema.eventRegistrations.eventId, event.id));
        if (Number(regCount[0]?.count ?? 0) >= event.maxParticipants) {
            throw new AppError(ErrorCodes.CONFLICT, 'This event is full', 409);
        }
    }
    await db.insert(schema.eventRegistrations).values({ eventId: event.id, userId }).onConflictDoNothing();
    return { registered: true, serverTimeMs: now.getTime() };
}
export async function unregisterForEvent(db, slug, userId) {
    const event = await db.query.events.findFirst({ where: eq(schema.events.slug, slug) });
    if (!event)
        throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    const deleted = await db
        .delete(schema.eventRegistrations)
        .where(and(eq(schema.eventRegistrations.eventId, event.id), eq(schema.eventRegistrations.userId, userId)))
        .returning();
    return { unregistered: deleted.length > 0 };
}
/** Standings from resolved matches associated with this event. */
export async function getEventStandings(db, slug, limit = 20) {
    const event = await db.query.events.findFirst({ where: eq(schema.events.slug, slug) });
    if (!event)
        throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    const participants = await db.query.matchParticipants.findMany({
        with: {
            match: true,
            user: { with: { profile: true } },
        },
    });
    const scored = new Map();
    for (const p of participants) {
        if (p.match.eventId !== event.id)
            continue;
        if (!['resolved', 'draw', 'abandoned'].includes(p.match.status))
            continue;
        const entry = scored.get(p.userId) ?? {
            handle: p.user.profile?.handle ?? null,
            avatarUrl: p.user.profile?.avatarUrl ?? null,
            points: 0,
            wins: 0,
            games: 0,
        };
        entry.games += 1;
        if (p.match.winnerUserId === p.userId) {
            entry.points += 3;
            entry.wins += 1;
        }
        else if (p.match.status === 'draw' || !p.match.winnerUserId) {
            entry.points += 1;
        }
        scored.set(p.userId, entry);
    }
    return [...scored.values()]
        .sort((a, b) => b.points - a.points || a.handle?.localeCompare(b.handle ?? '') || 0)
        .slice(0, limit);
}
//# sourceMappingURL=service.js.map