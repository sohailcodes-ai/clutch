export declare const DEFAULT_RATING = 1000;
export declare const PLACEMENT_MATCHES = 5;
export declare const MATCH_TIME_LIMIT_SEC = 900;
export declare const READY_WINDOW_SEC = 30;
export declare const DISCONNECT_FORFEIT_SEC = 60;
export declare const QUEUE_BAND_INITIAL = 50;
export declare const QUEUE_BAND_STEP = 50;
export declare const QUEUE_BAND_MAX = 400;
export declare const SEASON_SOFT_RESET_FACTOR = 0.8;
export declare const SEASON_DECAY_AFTER_DAYS = 14;
export declare const RATING_FLOOR = 100;
export declare const MAX_CODE_SIZE_BYTES = 65536;
export declare const MATCH_STATUSES: readonly ["queued", "matched", "starting", "active", "evaluating", "resolved", "cancelled", "abandoned", "draw"];
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export declare const SUBMISSION_STATUSES: readonly ["received", "queued", "running", "accepted", "wrong_answer", "time_limit", "runtime_error", "compile_error", "internal_error"];
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
/**
 * ============================================================================
 * CONFIGURABLE PROGRESSION LADDER
 * ----------------------------------------------------------------------------
 * The final competitive naming is still being designed. These identifiers are
 * DATA: they live in the database (difficulty_bands) and are seeded from here.
 * Nothing outside this file and the seed should hardcode band names — always
 * look up bands by rating range or id from PostgreSQL.
 * Rating ranges are editable; keep ids stable once published.
 * ============================================================================
 */
export declare const DIFFICULTY_LADDER: readonly [{
    readonly id: "rookie";
    readonly label: "Rookie";
    readonly minRating: 0;
    readonly maxRating: 899;
}, {
    readonly id: "starter";
    readonly label: "Starter";
    readonly minRating: 900;
    readonly maxRating: 999;
}, {
    readonly id: "beginner";
    readonly label: "Beginner";
    readonly minRating: 1000;
    readonly maxRating: 1099;
}, {
    readonly id: "easy";
    readonly label: "Easy";
    readonly minRating: 1100;
    readonly maxRating: 1299;
}, {
    readonly id: "medium";
    readonly label: "Medium";
    readonly minRating: 1300;
    readonly maxRating: 1599;
}, {
    readonly id: "hard";
    readonly label: "Hard";
    readonly minRating: 1600;
    readonly maxRating: 1899;
}, {
    readonly id: "advanced";
    readonly label: "Advanced";
    readonly minRating: 1900;
    readonly maxRating: 2199;
}, {
    readonly id: "elite";
    readonly label: "Elite";
    readonly minRating: 2200;
    readonly maxRating: 2399;
}, {
    readonly id: "clutch";
    readonly label: "CLUTCH";
    readonly minRating: 2400;
    readonly maxRating: 99999;
}];
export type DifficultyLadderEntry = (typeof DIFFICULTY_LADDER)[number];
export declare const DIFFICULTY_IDS: ("rookie" | "starter" | "beginner" | "easy" | "medium" | "hard" | "advanced" | "elite" | "clutch")[];
/** Editor telemetry thresholds that trigger anti-cheat review flags. */
export declare const TELEMETRY_LIMITS: {
    readonly MAX_EVENTS_PER_BATCH: 50;
    readonly MAX_PASTE_COUNT: 5;
    readonly MAX_DROP_COUNT: 3;
};
/** Similarity detection input bounds (defence against DoS via huge inputs). */
export declare const SIMILARITY_LIMITS: {
    readonly MAX_NORMALIZED_CHARS: 20000;
    readonly SHINGLE_SIZE: 20;
    readonly SAMPLE_STRIDE: 3;
    readonly FLAG_THRESHOLD: 0.85;
};
/**
 * ============================================================================
 * SUPPORTED STACK CATALOG
 * ----------------------------------------------------------------------------
 * Stacks are DATA (rows in the `stacks` table); this catalog is what the seed
 * provisions. The question/matchmaking system reads stacks from PostgreSQL —
 * never from this list — so new stacks can be added without code changes.
 * `judgeRuntime` names the worker evaluation runtime for the stack.
 * ============================================================================
 */
export declare const STACK_CATALOG: readonly [{
    readonly id: "python";
    readonly name: "Python";
    readonly symbol: "PY";
    readonly judgeRuntime: "python";
}, {
    readonly id: "javascript";
    readonly name: "JavaScript";
    readonly symbol: "JS";
    readonly judgeRuntime: "javascript";
}, {
    readonly id: "typescript";
    readonly name: "TypeScript";
    readonly symbol: "TS";
    readonly judgeRuntime: "typescript";
}, {
    readonly id: "java";
    readonly name: "Java";
    readonly symbol: "JV";
    readonly judgeRuntime: "java";
}, {
    readonly id: "c";
    readonly name: "C";
    readonly symbol: "C";
    readonly judgeRuntime: "c";
}, {
    readonly id: "cpp";
    readonly name: "C++";
    readonly symbol: "C+";
    readonly judgeRuntime: "cpp";
}, {
    readonly id: "csharp";
    readonly name: "C#";
    readonly symbol: "C#";
    readonly judgeRuntime: "csharp";
}, {
    readonly id: "go";
    readonly name: "Go";
    readonly symbol: "GO";
    readonly judgeRuntime: "go";
}, {
    readonly id: "rust";
    readonly name: "Rust";
    readonly symbol: "RS";
    readonly judgeRuntime: "rust";
}, {
    readonly id: "php";
    readonly name: "PHP";
    readonly symbol: "PHP";
    readonly judgeRuntime: "php";
}, {
    readonly id: "kotlin";
    readonly name: "Kotlin";
    readonly symbol: "KT";
    readonly judgeRuntime: "kotlin";
}, {
    readonly id: "swift";
    readonly name: "Swift";
    readonly symbol: "SW";
    readonly judgeRuntime: "swift";
}, {
    readonly id: "sql";
    readonly name: "SQL";
    readonly symbol: "SQL";
    readonly judgeRuntime: "sql";
}];
export type StackCatalogEntry = (typeof STACK_CATALOG)[number];
export declare const STACK_IDS: ("python" | "javascript" | "typescript" | "java" | "c" | "cpp" | "csharp" | "go" | "rust" | "php" | "kotlin" | "swift" | "sql")[];
/** Title rarity tiers. Rarity gates nothing about unlock logic — criteria do —
 *  but is used for display ordering and discovery emphasis. */
export declare const TITLE_RARITIES: readonly ["common", "uncommon", "rare", "epic", "legendary"];
export type TitleRarity = (typeof TITLE_RARITIES)[number];
/**
 * ============================================================================
 * ROOMS
 * ============================================================================
 */
export declare const ROOM_STATUS: readonly ["open", "in_progress", "closed"];
export type RoomStatus = (typeof ROOM_STATUS)[number];
export declare const ROOM_LIMITS: {
    readonly MIN_PLAYERS: 2;
    readonly MAX_PLAYERS: 16;
    readonly DEFAULT_PLAYERS: 8;
    readonly MIN_TIME_LIMIT_SEC: 60;
    readonly MAX_TIME_LIMIT_SEC: 3600;
    readonly JOIN_CODE_LENGTH: 6;
    readonly MAX_OPEN_ROOMS_PER_HOST: 3;
};
export declare const QUESTION_SELECTION_MODES: readonly ["random", "adaptive"];
export type QuestionSelectionMode = (typeof QUESTION_SELECTION_MODES)[number];
/**
 * ============================================================================
 * EVENTS & TOURNAMENTS
 * ============================================================================
 */
export declare const EVENT_STATUSES: readonly ["draft", "published", "cancelled", "completed"];
export type EventStatus = (typeof EVENT_STATUSES)[number];
export declare const TOURNAMENT_FORMATS: readonly ["single_elimination", "double_elimination", "round_robin"];
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];
export declare const TOURNAMENT_STATUSES: readonly ["draft", "registration_open", "seeding", "running", "completed", "cancelled"];
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];
export declare const TOURNAMENT_ROUND_STATUSES: readonly ["pending", "ready", "running", "completed"];
export type TournamentRoundStatus = (typeof TOURNAMENT_ROUND_STATUSES)[number];
/**
 * ============================================================================
 * ADMIN ROLES & PERMISSIONS
 * ----------------------------------------------------------------------------
 * Roles are stored on users.role (data); the permission matrix below is the
 * single server-side source of truth. Authorization ALWAYS flows through
 * hasPermission() against the database-backed session user — never through
 * client claims or handle-string checks.
 * ============================================================================
 */
export declare const ADMIN_ROLES: readonly ["super_admin", "admin", "moderator", "question_admin", "event_admin", "tournament_admin", "match_moderator"];
export type AdminRole = (typeof ADMIN_ROLES)[number];
export declare function isAdminRole(role: string): role is AdminRole;
export declare const ADMIN_PERMISSIONS: readonly ["admin.dashboard.view", "admin.matches.view", "admin.matches.inspect", "admin.matches.adjudicate", "admin.questions.create", "admin.questions.edit", "admin.questions.publish", "admin.questions.archive", "admin.users.view", "admin.users.moderate", "admin.security.view", "admin.events.create", "admin.events.manage", "admin.tournaments.manage", "admin.titles.manage", "admin.audit.view"];
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
/**
 * Permission matrix. Note: only SUPER_ADMIN holds `admin.security.view` —
 * ordinary administrators must NOT automatically access security-sensitive
 * data (IPs, session metadata).
 */
export declare const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]>;
/** Server-side authorization check. Regular users hold no permissions. */
export declare function hasPermission(role: string, permission: AdminPermission): boolean;
//# sourceMappingURL=constants.d.ts.map