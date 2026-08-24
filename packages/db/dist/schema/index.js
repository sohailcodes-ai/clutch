import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, pgEnum, uniqueIndex, index, bigint, numeric, unique, } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'banned']);
export const matchStatusEnum = pgEnum('match_status', [
    'queued',
    'matched',
    'starting',
    'active',
    'evaluating',
    'resolved',
    'cancelled',
    'abandoned',
    'draw',
]);
export const matchResultEnum = pgEnum('match_result', [
    'win',
    'loss',
    'draw',
    'forfeit',
    'no_result',
]);
export const submissionStatusEnum = pgEnum('submission_status', [
    'received',
    'queued',
    'running',
    'accepted',
    'wrong_answer',
    'time_limit',
    'runtime_error',
    'compile_error',
    'internal_error',
]);
export const queueStatusEnum = pgEnum('queue_status', ['waiting', 'matched', 'cancelled', 'expired']);
export const seasonStatusEnum = pgEnum('season_status', ['upcoming', 'active', 'archived']);
export const questionStatusEnum = pgEnum('question_status', ['draft', 'published', 'retired']);
export const testVisibilityEnum = pgEnum('test_visibility', ['public', 'hidden']);
export const abuseSeverityEnum = pgEnum('abuse_severity', ['low', 'medium', 'high']);
export const abuseStatusEnum = pgEnum('abuse_status', ['open', 'reviewed', 'actioned', 'dismissed']);
export const titleRarityEnum = pgEnum('title_rarity', [
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary',
]);
export const roomStatusEnum = pgEnum('room_status', ['open', 'in_progress', 'closed']);
export const eventStatusEnum = pgEnum('event_status', ['draft', 'published', 'cancelled', 'completed']);
export const tournamentFormatEnum = pgEnum('tournament_format', [
    'single_elimination',
    'double_elimination',
    'round_robin',
]);
export const tournamentStatusEnum = pgEnum('tournament_status', [
    'draft',
    'registration_open',
    'seeding',
    'running',
    'completed',
    'cancelled',
]);
export const tournamentRoundStatusEnum = pgEnum('tournament_round_status', [
    'pending',
    'ready',
    'running',
    'completed',
]);
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    status: userStatusEnum('status').notNull().default('active'),
    role: text('role').notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const userProfiles = pgTable('user_profiles', {
    userId: uuid('user_id')
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    handle: text('handle').notNull().unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    region: text('region').notNull().default('global'),
    bio: text('bio'),
    /** The ONE title the player displays. Must reference an owned award. */
    equippedTitleId: uuid('equipped_title_id').references(() => titles.id, { onDelete: 'set null' }),
    /** Server-authoritative first-time onboarding marker (null = not done). */
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    /** Preferred competitive stack chosen during onboarding (display/queue
     *  pre-selection only; matchmaking itself stays stack-agnostic). */
    primaryStackId: text('primary_stack_id').references(() => stacks.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const authSessions = pgTable('auth_sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const stacks = pgTable('stacks', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    symbol: text('symbol').notNull(),
    judgeRuntime: text('judge_runtime').notNull(),
    isActive: boolean('is_active').notNull().default(true),
});
export const rankTiers = pgTable('rank_tiers', {
    id: text('id').primaryKey(),
    minRating: integer('min_rating').notNull(),
    maxRating: integer('max_rating'),
    sortOrder: integer('sort_order').notNull(),
});
export const seasons = pgTable('seasons', {
    id: uuid('id').primaryKey().defaultRandom(),
    number: integer('number').notNull().unique(),
    name: text('name').notNull(),
    title: text('title'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: seasonStatusEnum('status').notNull().default('upcoming'),
    softResetFactor: numeric('soft_reset_factor', { precision: 4, scale: 3 }).notNull().default('0.800'),
    decayAfterDays: integer('decay_after_days').notNull().default(14),
    placementMatches: integer('placement_matches').notNull().default(5),
});
export const userStackRatings = pgTable('user_stack_ratings', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    stackId: text('stack_id')
        .notNull()
        .references(() => stacks.id),
    rating: integer('rating').notNull().default(1000),
    tierId: text('tier_id').references(() => rankTiers.id),
    gamesPlayed: integer('games_played').notNull().default(0),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    draws: integer('draws').notNull().default(0),
    placementRemaining: integer('placement_remaining').notNull().default(5),
    peakRating: integer('peak_rating').notNull().default(1000),
    lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    unique().on(table.userId, table.stackId),
    index('idx_user_stack_ratings_leaderboard').on(table.stackId, table.rating),
]);
export const seasonRatingSnapshots = pgTable('season_rating_snapshots', {
    id: uuid('id').primaryKey().defaultRandom(),
    seasonId: uuid('season_id')
        .notNull()
        .references(() => seasons.id),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    stackId: text('stack_id')
        .notNull()
        .references(() => stacks.id),
    startRating: integer('start_rating').notNull(),
    endRating: integer('end_rating'),
    peakRating: integer('peak_rating').notNull(),
    gamesPlayed: integer('games_played').notNull().default(0),
    finalRank: integer('final_rank'),
}, (table) => [unique().on(table.seasonId, table.userId, table.stackId)]);
export const difficultyBands = pgTable('difficulty_bands', {
    id: text('id').primaryKey(),
    minRating: integer('min_rating').notNull(),
    maxRating: integer('max_rating').notNull(),
    sortOrder: integer('sort_order').notNull(),
});
export const questions = pgTable('questions', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    descriptionMd: text('description_md'),
    difficultyId: text('difficulty_id')
        .notNull()
        .references(() => difficultyBands.id),
    topic: text('topic').notNull().default('general'),
    tags: jsonb('tags').notNull().default([]),
    // Provenance: prefer Clutch-original content; external content must be
    // properly licensed and attributed.
    source: text('source').notNull().default('clutch-original'),
    license: text('license'),
    attribution: text('attribution'),
    timeLimitSec: integer('time_limit_sec').notNull().default(900),
    memoryLimitMb: integer('memory_limit_mb').notNull().default(256),
    status: questionStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const questionVersions = pgTable('question_versions', {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
        .notNull()
        .references(() => questions.id),
    version: integer('version').notNull(),
    promptMd: text('prompt_md').notNull(),
    examples: jsonb('examples').notNull().default([]),
    starterCode: jsonb('starter_code').notNull().default({}),
    constraints: jsonb('constraints').notNull().default({}),
    publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => [unique().on(table.questionId, table.version)]);
export const questionStackSupport = pgTable('question_stack_support', {
    questionId: uuid('question_id')
        .notNull()
        .references(() => questions.id),
    stackId: text('stack_id')
        .notNull()
        .references(() => stacks.id),
}, (table) => [unique().on(table.questionId, table.stackId)]);
export const testCases = pgTable('test_cases', {
    id: uuid('id').primaryKey().defaultRandom(),
    questionVersionId: uuid('question_version_id')
        .notNull()
        .references(() => questionVersions.id),
    ordinal: integer('ordinal').notNull(),
    visibility: testVisibilityEnum('visibility').notNull(),
    input: text('input').notNull(),
    expectedOutput: text('expected_output').notNull(),
    weight: integer('weight').notNull().default(1),
    timeLimitMs: integer('time_limit_ms'),
    memoryLimitMb: integer('memory_limit_mb'),
});
export const userQuestionHistory = pgTable('user_question_history', {
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    questionId: uuid('question_id')
        .notNull()
        .references(() => questions.id),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    timesSeen: integer('times_seen').notNull().default(1),
}, (table) => [unique().on(table.userId, table.questionId)]);
export const matches = pgTable('matches', {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: text('public_id').notNull().unique(),
    seasonId: uuid('season_id')
        .notNull()
        .references(() => seasons.id),
    stackId: text('stack_id')
        .notNull()
        .references(() => stacks.id),
    questionVersionId: uuid('question_version_id')
        .notNull()
        .references(() => questionVersions.id),
    difficultyId: text('difficulty_id')
        .notNull()
        .references(() => difficultyBands.id),
    status: matchStatusEnum('status').notNull().default('queued'),
    timeLimitSec: integer('time_limit_sec').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    winnerUserId: uuid('winner_user_id').references(() => users.id),
    resolveReason: text('resolve_reason'),
    version: integer('version').notNull().default(1),
    /** Unranked matches (e.g. custom rooms) never touch the ELO system. */
    ranked: boolean('ranked').notNull().default(true),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    tournamentId: uuid('tournament_id').references(() => tournaments.id, {
        onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const matchParticipants = pgTable('match_participants', {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
        .notNull()
        .references(() => matches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    slot: integer('slot').notNull(),
    ratingBefore: integer('rating_before').notNull(),
    ratingAfter: integer('rating_after'),
    result: matchResultEnum('result'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
}, (table) => [
    unique().on(table.matchId, table.userId),
    unique().on(table.matchId, table.slot),
]);
export const queueEntries = pgTable('queue_entries', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    stackId: text('stack_id')
        .notNull()
        .references(() => stacks.id),
    seasonId: uuid('season_id')
        .notNull()
        .references(() => seasons.id),
    rating: integer('rating').notNull(),
    region: text('region').notNull(),
    difficultyId: text('difficulty_id').references(() => difficultyBands.id),
    status: queueStatusEnum('status').notNull().default('waiting'),
    enqueuedAt: timestamp('enqueued_at', { withTimezone: true }).notNull().defaultNow(),
    matchedAt: timestamp('matched_at', { withTimezone: true }),
    matchId: uuid('match_id').references(() => matches.id),
}, (table) => [
    index('idx_queue_waiting_user').on(table.userId, table.status),
    // A user may hold at most one waiting queue entry; enforced by the database
    // so concurrent join attempts cannot create duplicates.
    uniqueIndex('uq_queue_entries_user_waiting')
        .on(table.userId)
        .where(sql `status = 'waiting'`),
]);
export const submissions = pgTable('submissions', {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
        .notNull()
        .references(() => matches.id),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    questionVersionId: uuid('question_version_id')
        .notNull()
        .references(() => questionVersions.id),
    sourceCode: text('source_code').notNull(),
    language: text('language').notNull(),
    status: submissionStatusEnum('status').notNull().default('received'),
    passedCount: integer('passed_count').notNull().default(0),
    totalCount: integer('total_count').notNull().default(0),
    executionTimeMs: integer('execution_time_ms'),
    memoryKb: integer('memory_kb'),
    isFinal: boolean('is_final').notNull().default(false),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique().on(table.matchId, table.userId, table.idempotencyKey)]);
export const submissionRuns = pgTable('submission_runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
        .notNull()
        .references(() => submissions.id, { onDelete: 'cascade' }),
    testCaseId: uuid('test_case_id')
        .notNull()
        .references(() => testCases.id),
    status: submissionStatusEnum('status').notNull(),
    stdout: text('stdout'),
    stderr: text('stderr'),
    executionTimeMs: integer('execution_time_ms'),
    memoryKb: integer('memory_kb'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const ratingLedger = pgTable('rating_ledger', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    stackId: text('stack_id')
        .notNull()
        .references(() => stacks.id),
    matchId: uuid('match_id')
        .notNull()
        .references(() => matches.id),
    seasonId: uuid('season_id')
        .notNull()
        .references(() => seasons.id),
    ratingBefore: integer('rating_before').notNull(),
    ratingDelta: integer('rating_delta').notNull(),
    ratingAfter: integer('rating_after').notNull(),
    kFactor: integer('k_factor').notNull(),
    expectedScore: numeric('expected_score', { precision: 6, scale: 4 }).notNull(),
    actualScore: numeric('actual_score', { precision: 3, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const matchEvents = pgTable('match_events', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    matchId: uuid('match_id')
        .notNull()
        .references(() => matches.id),
    eventType: text('event_type').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('idx_match_events_match').on(table.matchId, table.createdAt)]);
export const auditLog = pgTable('audit_log', {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const abuseFlags = pgTable('abuse_flags', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    matchId: uuid('match_id').references(() => matches.id),
    flagType: text('flag_type').notNull(),
    severity: abuseSeverityEnum('severity').notNull(),
    evidence: jsonb('evidence').notNull().default({}),
    status: abuseStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const idempotencyRecords = pgTable('idempotency_records', {
    key: text('key').primaryKey(),
    userId: uuid('user_id').notNull(),
    route: text('route').notNull(),
    requestHash: text('request_hash').notNull(),
    responseCode: integer('response_code').notNull(),
    responseBody: jsonb('response_body').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
// ---------------------------------------------------------------------------
// Product layer: titles/badges, progression, anti-cheat telemetry
// ---------------------------------------------------------------------------
/** Data-driven title/badge definitions. Awarded only server-side. */
export const titles = pgTable('titles', {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    kind: text('kind').notNull().default('title'), // 'title' | 'badge'
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Display rarity — ordering/emphasis only; unlock is criteria-driven. */
    rarity: titleRarityEnum('rarity').notNull().default('common'),
    /** Secret achievements hide their condition until unlocked. */
    isSecret: boolean('is_secret').notNull().default(false),
    /** Structural criteria evaluated by the domain service, e.g.
     *  { type: 'wins', value: 1 } | { type: 'rating', stackId?, value } */
    criteria: jsonb('criteria').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const userTitles = pgTable('user_titles', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    titleId: uuid('title_id')
        .notNull()
        .references(() => titles.id),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
    matchId: uuid('match_id').references(() => matches.id),
}, (table) => [
    unique().on(table.userId, table.titleId),
    index('idx_user_titles_user').on(table.userId),
]);
/** Per-user per-question attempt/solve aggregation for progression. */
export const userQuestionStats = pgTable('user_question_stats', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
        .notNull()
        .references(() => questions.id),
    topic: text('topic').notNull().default('general'),
    difficultyId: text('difficulty_id').notNull(),
    attempts: integer('attempts').notNull().default(0),
    solved: integer('solved').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    bestTimeMs: integer('best_time_ms'),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    unique().on(table.userId, table.questionId),
    index('idx_uqs_user_topic').on(table.userId, table.topic),
]);
/** Aggregated editor telemetry per participant per match (anti-cheat signal). */
export const matchTelemetry = pgTable('match_telemetry', {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
        .notNull()
        .references(() => matches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    pasteCount: integer('paste_count').notNull().default(0),
    dropCount: integer('drop_count').notNull().default(0),
    copyCount: integer('copy_count').notNull().default(0),
    blurCount: integer('blur_count').notNull().default(0),
    focusCount: integer('focus_count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique().on(table.matchId, table.userId)]);
// ---------------------------------------------------------------------------
// Multi-stack question taxonomy: relational topic catalog
// ---------------------------------------------------------------------------
/**
 * Topic catalog. Topics belong to a stack (e.g. python-pointers → cpp) or are
 * cross-stack (stackId null, e.g. algorithms). Questions link to topics via
 * question_topics; the legacy `questions.topic` text column remains for the
 * progression aggregation until it is fully migrated.
 */
export const topics = pgTable('topics', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
    /** Null = cross-stack topic (algorithms, data structures...). */
    stackId: text('stack_id').references(() => stacks.id),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
}, (table) => [unique().on(table.slug, table.stackId)]);
export const questionTopics = pgTable('question_topics', {
    questionId: uuid('question_id')
        .notNull()
        .references(() => questions.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id')
        .notNull()
        .references(() => topics.id, { onDelete: 'cascade' }),
}, (table) => [unique().on(table.questionId, table.topicId)]);
// ---------------------------------------------------------------------------
// Custom competitive rooms
// ---------------------------------------------------------------------------
export const rooms = pgTable('rooms', {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: text('public_id').notNull().unique(),
    name: text('name').notNull(),
    hostUserId: uuid('host_user_id')
        .notNull()
        .references(() => users.id),
    stackId: text('stack_id')
        .notNull()
        .references(() => stacks.id),
    difficultyId: text('difficulty_id').references(() => difficultyBands.id),
    maxPlayers: integer('max_players').notNull(),
    isPublic: boolean('is_public').notNull().default(true),
    ranked: boolean('ranked').notNull().default(false),
    timeLimitSec: integer('time_limit_sec').notNull().default(900),
    questionSelectionMode: text('question_selection_mode').notNull().default('adaptive'),
    /** Server-generated access code for private rooms. Never listed. */
    joinCode: text('join_code'),
    status: roomStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index('idx_rooms_status_public').on(table.status, table.isPublic),
    uniqueIndex('uq_rooms_open_host')
        .on(table.hostUserId)
        .where(sql `status = 'open'`),
]);
export const roomParticipants = pgTable('room_participants', {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
        .notNull()
        .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp('ready_at', { withTimezone: true }),
}, (table) => [
    unique().on(table.roomId, table.userId),
    index('idx_room_participants_room').on(table.roomId),
]);
// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export const events = pgTable('events', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    descriptionMd: text('description_md'),
    rulesMd: text('rules_md'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    maxParticipants: integer('max_participants'),
    rewardTitleIds: jsonb('reward_title_ids').notNull().default([]),
    status: eventStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const eventStacks = pgTable('event_stacks', {
    eventId: uuid('event_id')
        .notNull()
        .references(() => events.id, { onDelete: 'cascade' }),
    stackId: text('stack_id')
        .notNull()
        .references(() => stacks.id),
}, (table) => [unique().on(table.eventId, table.stackId)]);
export const eventDifficultyLevels = pgTable('event_difficulty_levels', {
    eventId: uuid('event_id')
        .notNull()
        .references(() => events.id, { onDelete: 'cascade' }),
    difficultyId: text('difficulty_id')
        .notNull()
        .references(() => difficultyBands.id),
}, (table) => [unique().on(table.eventId, table.difficultyId)]);
export const eventRegistrations = pgTable('event_registrations', {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
        .notNull()
        .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    unique().on(table.eventId, table.userId),
    index('idx_event_registrations_event').on(table.eventId),
]);
// ---------------------------------------------------------------------------
// Tournament foundation
// ---------------------------------------------------------------------------
export const tournaments = pgTable('tournaments', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    descriptionMd: text('description_md'),
    format: tournamentFormatEnum('format').notNull().default('single_elimination'),
    seasonId: uuid('season_id')
        .notNull()
        .references(() => seasons.id),
    stackId: text('stack_id')
        .notNull()
        .references(() => stacks.id),
    maxParticipants: integer('max_participants').notNull(),
    registrationOpensAt: timestamp('registration_opens_at', { withTimezone: true }).notNull(),
    registrationClosesAt: timestamp('registration_closes_at', { withTimezone: true }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    championUserId: uuid('champion_user_id').references(() => users.id),
    rewardTitleIds: jsonb('reward_title_ids').notNull().default([]),
    status: tournamentStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const tournamentRegistrations = pgTable('tournament_registrations', {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
        .notNull()
        .references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    seed: integer('seed'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    unique().on(table.tournamentId, table.userId),
    index('idx_tournament_registrations_tournament').on(table.tournamentId),
]);
/** Bracket/round concept — foundation for automated bracket generation. */
export const tournamentRounds = pgTable('tournament_rounds', {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
        .notNull()
        .references(() => tournaments.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    name: text('name').notNull().default('Round'),
    status: tournamentRoundStatusEnum('status').notNull().default('pending'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
}, (table) => [unique().on(table.tournamentId, table.roundNumber)]);
//# sourceMappingURL=index.js.map