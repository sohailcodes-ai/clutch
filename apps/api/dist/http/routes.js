import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { AppError, ErrorCodes, registerSchema, loginSchema, updateProfileSchema, completeOnboardingSchema, queueJoinSchema, matchSubmitSchema, editorTelemetrySchema, listQuestionsQuerySchema, } from '@clutch/shared';
import { schema } from '@clutch/db';
import { loginUser, logoutUser, registerUser, updateProfile, getUserRatings, completeOnboarding, listStacks, getCurrentSeason, joinQueue, leaveQueue, getQueueStatus, userHasActiveMatch, markReady, forfeitMatch, getMatchSnapshot, createSubmission, getLeaderboard, getUserRank, checkRateLimit, withIdempotency, enqueueSubmissionEvaluation, shouldEvaluateMatch, markMatchEvaluating, resolveMatch, recordEditorTelemetry, recommendNextQuestions, getUserProgress, listActiveTitles, getPublicProfile, getUserAwards, } from '@clutch/domain';
import { requireAuth } from '../middleware/auth.js';
const SESSION_COOKIE = 'clutch_session';
/** Strips credential material (password hashes) before serialization. */
function publicUser(user) {
    return {
        id: user.id,
        email: user.email,
        status: user.status,
        role: user.role,
        createdAt: user.createdAt,
        profile: user.profile ?? null,
    };
}
function getClientIp(request) {
    return request.ip;
}
async function enforceRateLimit(request, opts) {
    const result = await checkRateLimit(request.server.redis, opts.key, opts.limit, opts.windowSec, { failClosed: opts.failClosed });
    if (!result.allowed) {
        throw new AppError(ErrorCodes.RATE_LIMITED, 'Too many requests', 429, true);
    }
}
function parse(schema, data) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        throw new AppError(ErrorCodes.VALIDATION, 'Invalid request', 400);
    }
    return parsed.data;
}
function setSessionCookie(reply, token, expiresAt) {
    void reply.setCookie(SESSION_COOKIE, token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
    });
}
export async function resolveWhenReady(db, redis, matchId) {
    if (!(await shouldEvaluateMatch(db, matchId)))
        return false;
    await markMatchEvaluating(db, redis, matchId);
    await resolveMatch(db, redis, matchId);
    return true;
}
export async function registerHttpRoutes(app) {
    // ---------------------------------------------------------------------------
    // Auth
    // ---------------------------------------------------------------------------
    app.post('/auth/register', async (request, reply) => {
        await enforceRateLimit(request, {
            key: `auth:register:${getClientIp(request)}`,
            limit: 5,
            windowSec: 3600,
            failClosed: true,
        });
        const input = parse(registerSchema, request.body);
        const { user, token, expiresAt } = await registerUser(request.server.db, input, {
            ipAddress: getClientIp(request),
            userAgent: request.headers['user-agent'],
        });
        // registerUser returns the bare user row; hydrate the profile for the response.
        const profile = await request.server.db.query.userProfiles.findFirst({
            where: eq(schema.userProfiles.userId, user.id),
        });
        setSessionCookie(reply, token, expiresAt);
        void reply.code(201);
        return { user: { ...publicUser(user), profile: profile ?? null }, expiresAt };
    });
    app.post('/auth/login', async (request, reply) => {
        await enforceRateLimit(request, {
            key: `auth:login:${getClientIp(request)}`,
            limit: 10,
            windowSec: 900,
            failClosed: true,
        });
        const input = parse(loginSchema, request.body);
        const { user, token, expiresAt } = await loginUser(request.server.db, input, {
            ipAddress: getClientIp(request),
            userAgent: request.headers['user-agent'],
        });
        setSessionCookie(reply, token, expiresAt);
        return { user: publicUser(user), expiresAt };
    });
    app.post('/auth/logout', { preHandler: [requireAuth] }, async (request, reply) => {
        if (request.sessionToken) {
            await logoutUser(request.server.db, request.sessionToken);
        }
        void reply.clearCookie(SESSION_COOKIE, { path: '/' });
        return { ok: true };
    });
    app.get('/auth/me', { preHandler: [requireAuth] }, async (request) => {
        return { user: publicUser(request.user) };
    });
    // ---------------------------------------------------------------------------
    // Profile & meta
    // ---------------------------------------------------------------------------
    app.get('/profile', { preHandler: [requireAuth] }, async (request) => {
        const userId = request.user.id;
        const [ratings, stacks, season] = await Promise.all([
            getUserRatings(request.server.db, userId),
            listStacks(request.server.db),
            getCurrentSeason(request.server.db),
        ]);
        return { ratings, stacks, season };
    });
    app.patch('/profile', { preHandler: [requireAuth] }, async (request) => {
        const input = parse(updateProfileSchema, request.body);
        const profile = await updateProfile(request.server.db, request.user.id, input);
        return { profile };
    });
    // First-time onboarding completion (server-authoritative marker).
    app.post('/profile/onboarding', { preHandler: [requireAuth] }, async (request) => {
        const input = parse(completeOnboardingSchema, request.body);
        const profile = await completeOnboarding(request.server.db, request.user.id, input);
        return { profile };
    });
    app.get('/players/:handle', async (request) => {
        const { handle } = parse(z.object({ handle: z.string().min(3).max(24) }), request.params);
        const profile = await getPublicProfile(request.server.db, handle);
        if (!profile)
            throw new AppError(ErrorCodes.NOT_FOUND, 'Player not found', 404);
        return { player: profile };
    });
    // ---------------------------------------------------------------------------
    // Titles / badges (server-awarded; read-only here)
    // ---------------------------------------------------------------------------
    app.get('/titles', async (request) => {
        return { titles: await listActiveTitles(request.server.db) };
    });
    app.get('/titles/me', { preHandler: [requireAuth] }, async (request) => {
        const awards = await getUserAwards(request.server.db, request.user.id);
        return {
            titles: awards.map((a) => ({
                code: a.title.code,
                name: a.title.name,
                kind: a.title.kind,
                awardedAt: a.awardedAt,
            })),
        };
    });
    // ---------------------------------------------------------------------------
    // Practice: question catalog + deterministic progression
    // ---------------------------------------------------------------------------
    app.get('/practice/questions', async (request) => {
        const query = parse(listQuestionsQuerySchema, request.query);
        const supported = query.stackId
            ? (await request.server.db.query.questionStackSupport.findMany({
                where: eq(schema.questionStackSupport.stackId, query.stackId),
            })).map((s) => s.questionId)
            : [];
        const rows = await request.server.db.query.questions.findMany({
            where: and(eq(schema.questions.status, 'published'), query.difficultyId ? eq(schema.questions.difficultyId, query.difficultyId) : undefined, query.topic ? eq(schema.questions.topic, query.topic) : undefined, supported.length > 0 ? inArray(schema.questions.id, supported) : undefined),
            with: {
                versions: {
                    orderBy: desc(schema.questionVersions.version),
                    limit: 1,
                    with: { testCases: true },
                },
            },
            limit: query.limit,
            offset: query.offset,
        });
        return {
            questions: rows.flatMap((q) => {
                const v = q.versions[0];
                if (!v)
                    return [];
                return [
                    {
                        id: q.id,
                        slug: q.slug,
                        title: q.title,
                        descriptionMd: q.descriptionMd,
                        topic: q.topic,
                        tags: q.tags,
                        difficultyId: q.difficultyId,
                        timeLimitSec: q.timeLimitSec,
                        memoryLimitMb: q.memoryLimitMb,
                        source: q.source,
                        license: q.license,
                        attribution: q.attribution,
                        promptMd: v.promptMd,
                        examples: v.examples,
                        starterCode: v.starterCode,
                        publicTestCount: v.testCases.filter((t) => t.visibility === 'public').length,
                        hiddenTestCount: v.testCases.length - v.testCases.filter((t) => t.visibility === 'public').length,
                    },
                ];
            }),
        };
    });
    app.get('/practice/recommendations', { preHandler: [requireAuth] }, async (request) => {
        const query = parse(z.object({ stackId: z.string().min(1).max(32).optional() }), request.query);
        const result = await recommendNextQuestions(request.server.db, request.user.id, query.stackId, 5);
        return result;
    });
    app.get('/practice/progress', { preHandler: [requireAuth] }, async (request) => {
        return getUserProgress(request.server.db, request.user.id);
    });
    // ---------------------------------------------------------------------------
    // Anti-cheat editor telemetry (participant-only, bounded, non-authoritative)
    // ---------------------------------------------------------------------------
    app.post('/matches/:matchId/telemetry', { preHandler: [requireAuth] }, async (request) => {
        await enforceRateLimit(request, {
            key: `telemetry:${request.user.id}`,
            limit: 30,
            windowSec: 60,
        });
        const { matchId } = parse(z.object({ matchId: z.string().uuid() }), request.params);
        const input = parse(editorTelemetrySchema, request.body);
        // Authorization: only participants may submit telemetry for a match.
        const participant = await request.server.db.query.matchParticipants.findFirst({
            where: and(eq(schema.matchParticipants.matchId, matchId), eq(schema.matchParticipants.userId, request.user.id)),
        });
        if (!participant)
            throw new AppError(ErrorCodes.FORBIDDEN, 'Not a match participant', 403);
        const summary = await recordEditorTelemetry(request.server.db, {
            matchId,
            userId: request.user.id,
            events: input.events,
        });
        return { summary };
    });
    app.get('/meta/stacks', async (request) => {
        return { stacks: await listStacks(request.server.db) };
    });
    app.get('/meta/season', async (request) => {
        return { season: await getCurrentSeason(request.server.db) };
    });
    // ---------------------------------------------------------------------------
    // Matchmaking queue
    // ---------------------------------------------------------------------------
    app.post('/queue/join', { preHandler: [requireAuth] }, async (request, reply) => {
        await enforceRateLimit(request, {
            key: `queue:join:${request.user.id}`,
            limit: 10,
            windowSec: 60,
        });
        const input = parse(queueJoinSchema, request.body);
        const entry = await withIdempotency(request.server.db, {
            userId: request.user.id,
            route: 'queue.join',
            idempotencyKey: request.idempotencyKey ?? request.id,
            requestBody: input,
            handler: async () => ({
                statusCode: 201,
                body: await joinQueue(request.server.db, request.server.redis, {
                    userId: request.user.id,
                    ...input,
                }),
            }),
        });
        void reply.code(201);
        return { entry };
    });
    app.delete('/queue', { preHandler: [requireAuth] }, async (request) => {
        const entry = await leaveQueue(request.server.db, request.server.redis, request.user.id);
        return { entry };
    });
    app.get('/queue', { preHandler: [requireAuth] }, async (request) => {
        const entry = await getQueueStatus(request.server.db, request.user.id);
        return { entry: entry ?? null };
    });
    // ---------------------------------------------------------------------------
    // Matches
    // ---------------------------------------------------------------------------
    app.get('/matches/active', { preHandler: [requireAuth] }, async (request) => {
        const active = await userHasActiveMatch(request.server.db, request.user.id);
        if (!active)
            return { match: null };
        const snapshot = await getMatchSnapshot(request.server.db, active.matchId, request.user.id);
        return { match: snapshot };
    });
    app.get('/matches/:matchId', { preHandler: [requireAuth] }, async (request) => {
        const { matchId } = parse(z.object({ matchId: z.string().uuid() }), request.params);
        const snapshot = await getMatchSnapshot(request.server.db, matchId, request.user.id);
        // 404 rather than 403 so outsiders cannot probe for match existence.
        if (!snapshot)
            throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
        return { match: snapshot };
    });
    app.post('/matches/:matchId/ready', { preHandler: [requireAuth] }, async (request) => {
        const { matchId } = parse(z.object({ matchId: z.string().uuid() }), request.params);
        return markReady(request.server.db, request.server.redis, {
            matchId,
            userId: request.user.id,
        });
    });
    app.post('/matches/:matchId/forfeit', { preHandler: [requireAuth] }, async (request) => {
        const { matchId } = parse(z.object({ matchId: z.string().uuid() }), request.params);
        const outcome = await withIdempotency(request.server.db, {
            userId: request.user.id,
            route: 'match.forfeit',
            idempotencyKey: request.idempotencyKey ?? request.id,
            requestBody: { matchId },
            handler: async () => ({
                statusCode: 200,
                body: await forfeitMatch(request.server.db, request.server.redis, {
                    matchId,
                    userId: request.user.id,
                }),
            }),
        });
        // Forfeits put the match into an immediately-resolvable state.
        await resolveWhenReady(request.server.db, request.server.redis, matchId);
        return outcome;
    });
    app.post('/matches/:matchId/submissions', { preHandler: [requireAuth] }, async (request, reply) => {
        await enforceRateLimit(request, {
            key: `submission:${request.user.id}`,
            limit: 30,
            windowSec: 60,
        });
        const { matchId } = parse(z.object({ matchId: z.string().uuid() }), request.params);
        const input = parse(matchSubmitSchema, request.body);
        const submission = await createSubmission(request.server.db, request.server.redis, {
            matchId,
            userId: request.user.id,
            sourceCode: input.sourceCode,
            idempotencyKey: input.idempotencyKey,
            isFinal: input.isFinal,
        });
        // INFRASTRUCTURE BOUNDARY: the API never evaluates submitted code itself.
        // The job carries only the submission ID; an isolated worker owns it.
        if (submission.status === 'queued') {
            await enqueueSubmissionEvaluation(request.server.evalQueue, submission.id);
        }
        void reply.code(201);
        return {
            submission: {
                id: submission.id,
                status: submission.status,
                isFinal: submission.isFinal,
                createdAt: submission.createdAt,
            },
        };
    });
    // ---------------------------------------------------------------------------
    // Leaderboard & seasons
    // ---------------------------------------------------------------------------
    app.get('/leaderboard/:stackId', async (request) => {
        const params = parse(z.object({ stackId: z.string().min(1).max(32) }), request.params);
        const query = parse(z.object({
            limit: z.coerce.number().int().min(1).max(100).default(50),
            offset: z.coerce.number().int().min(0).max(10000).default(0),
        }), request.query);
        const entries = await getLeaderboard(request.server.db, params.stackId, query.limit, query.offset);
        return { entries };
    });
    app.get('/leaderboard/:stackId/rank', { preHandler: [requireAuth] }, async (request) => {
        const params = parse(z.object({ stackId: z.string().min(1).max(32) }), request.params);
        const rank = await getUserRank(request.server.db, request.user.id, params.stackId);
        return { rank };
    });
    app.get('/seasons/current', async (request) => {
        return { season: await getCurrentSeason(request.server.db) };
    });
}
//# sourceMappingURL=routes.js.map