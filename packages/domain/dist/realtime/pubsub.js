export function userChannel(userId) {
    return `user:${userId}`;
}
export function matchChannel(matchId) {
    return `match:${matchId}`;
}
export async function publishUserEvent(redis, userId, event) {
    const envelope = {
        type: event.type,
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        matchId: event.matchId,
        payload: event.payload ?? {},
    };
    await redis.publish(userChannel(userId), JSON.stringify(envelope));
}
export async function publishMatchEvent(redis, matchId, event) {
    const envelope = {
        type: event.type,
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        matchId,
        payload: event.payload ?? {},
    };
    await redis.publish(matchChannel(matchId), JSON.stringify(envelope));
}
export async function setPresence(redis, userId, matchId) {
    const key = `presence:${userId}`;
    await redis.set(key, JSON.stringify({ matchId, at: Date.now() }), 'EX', 30);
}
export async function getPresence(redis, userId) {
    const raw = await redis.get(`presence:${userId}`);
    return raw ? JSON.parse(raw) : null;
}
//# sourceMappingURL=pubsub.js.map