import { and, asc, eq, gt } from 'drizzle-orm';
import { schema } from '@clutch/db';
export async function appendMatchEvent(db, input) {
    const [event] = await db
        .insert(schema.matchEvents)
        .values({
        matchId: input.matchId,
        eventType: input.eventType,
        actorUserId: input.actorUserId,
        payload: input.payload ?? {},
    })
        .returning();
    return event;
}
export async function getMatchEventsSince(db, matchId, lastEventId) {
    const events = await db.query.matchEvents.findMany({
        where: lastEventId
            ? and(eq(schema.matchEvents.matchId, matchId), gt(schema.matchEvents.id, lastEventId))
            : eq(schema.matchEvents.matchId, matchId),
        orderBy: asc(schema.matchEvents.id),
    });
    return events;
}
//# sourceMappingURL=events.js.map