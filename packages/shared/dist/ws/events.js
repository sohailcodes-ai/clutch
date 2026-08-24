import { z } from 'zod';
export const wsClientEvents = {
    PRESENCE_PING: 'presence.ping',
    QUEUE_SUBSCRIBE: 'queue.subscribe',
    MATCH_SUBSCRIBE: 'match.subscribe',
    MATCH_READY: 'match.ready',
    MATCH_RESYNC: 'match.resync',
};
export const wsServerEvents = {
    QUEUE_JOINED: 'queue.joined',
    QUEUE_SEARCHING: 'queue.searching',
    MATCH_FOUND: 'match.found',
    MATCH_STARTING: 'match.starting',
    MATCH_ACTIVE: 'match.active',
    MATCH_PARTICIPANT_UPDATE: 'match.participant_update',
    SUBMISSION_QUEUED: 'submission.queued',
    SUBMISSION_PROGRESS: 'submission.progress',
    SUBMISSION_RESULT: 'submission.result',
    MATCH_EVALUATING: 'match.evaluating',
    MATCH_RESOLVED: 'match.resolved',
    MATCH_SNAPSHOT: 'match.snapshot',
    OBSERVER_SNAPSHOT: 'observer.snapshot',
    ADMIN_JOINED: 'admin.joined',
    ADMIN_LEFT: 'admin.left',
    MATCH_ADJUDICATED: 'match.adjudicated',
    RATING_UPDATED: 'rating.updated',
    ERROR: 'error',
};
export const wsEnvelopeSchema = z.object({
    type: z.string(),
    id: z.string().optional(),
    ts: z.string().optional(),
    matchId: z.string().uuid().optional(),
    payload: z.unknown().optional(),
});
//# sourceMappingURL=events.js.map