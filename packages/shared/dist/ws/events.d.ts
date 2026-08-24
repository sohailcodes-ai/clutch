import { z } from 'zod';
export declare const wsClientEvents: {
    readonly PRESENCE_PING: "presence.ping";
    readonly QUEUE_SUBSCRIBE: "queue.subscribe";
    readonly MATCH_SUBSCRIBE: "match.subscribe";
    readonly MATCH_READY: "match.ready";
    readonly MATCH_RESYNC: "match.resync";
};
export declare const wsServerEvents: {
    readonly QUEUE_JOINED: "queue.joined";
    readonly QUEUE_SEARCHING: "queue.searching";
    readonly MATCH_FOUND: "match.found";
    readonly MATCH_STARTING: "match.starting";
    readonly MATCH_ACTIVE: "match.active";
    readonly MATCH_PARTICIPANT_UPDATE: "match.participant_update";
    readonly SUBMISSION_QUEUED: "submission.queued";
    readonly SUBMISSION_PROGRESS: "submission.progress";
    readonly SUBMISSION_RESULT: "submission.result";
    readonly MATCH_EVALUATING: "match.evaluating";
    readonly MATCH_RESOLVED: "match.resolved";
    readonly MATCH_SNAPSHOT: "match.snapshot";
    readonly OBSERVER_SNAPSHOT: "observer.snapshot";
    readonly ADMIN_JOINED: "admin.joined";
    readonly ADMIN_LEFT: "admin.left";
    readonly MATCH_ADJUDICATED: "match.adjudicated";
    readonly RATING_UPDATED: "rating.updated";
    readonly ERROR: "error";
};
export declare const wsEnvelopeSchema: z.ZodObject<{
    type: z.ZodString;
    id: z.ZodOptional<z.ZodString>;
    ts: z.ZodOptional<z.ZodString>;
    matchId: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: string;
    id?: string | undefined;
    ts?: string | undefined;
    matchId?: string | undefined;
    payload?: unknown;
}, {
    type: string;
    id?: string | undefined;
    ts?: string | undefined;
    matchId?: string | undefined;
    payload?: unknown;
}>;
export type WsEnvelope = z.infer<typeof wsEnvelopeSchema>;
//# sourceMappingURL=events.d.ts.map