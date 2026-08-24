export const DEFAULT_RATING = 1000;
export const PLACEMENT_MATCHES = 5;
export const MATCH_TIME_LIMIT_SEC = 900;
export const READY_WINDOW_SEC = 30;
export const DISCONNECT_FORFEIT_SEC = 60;
export const QUEUE_BAND_INITIAL = 50;
export const QUEUE_BAND_STEP = 50;
export const QUEUE_BAND_MAX = 400;
export const SEASON_SOFT_RESET_FACTOR = 0.8;
export const SEASON_DECAY_AFTER_DAYS = 14;
export const RATING_FLOOR = 100;
export const MAX_CODE_SIZE_BYTES = 65536;
export const MATCH_STATUSES = [
    'queued',
    'matched',
    'starting',
    'active',
    'evaluating',
    'resolved',
    'cancelled',
    'abandoned',
    'draw',
];
export const SUBMISSION_STATUSES = [
    'received',
    'queued',
    'running',
    'accepted',
    'wrong_answer',
    'time_limit',
    'runtime_error',
    'compile_error',
    'internal_error',
];
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
export const DIFFICULTY_LADDER = [
    { id: 'rookie', label: 'Rookie', minRating: 0, maxRating: 899 },
    { id: 'starter', label: 'Starter', minRating: 900, maxRating: 999 },
    { id: 'beginner', label: 'Beginner', minRating: 1000, maxRating: 1099 },
    { id: 'easy', label: 'Easy', minRating: 1100, maxRating: 1299 },
    { id: 'medium', label: 'Medium', minRating: 1300, maxRating: 1599 },
    { id: 'hard', label: 'Hard', minRating: 1600, maxRating: 1899 },
    { id: 'advanced', label: 'Advanced', minRating: 1900, maxRating: 2199 },
    { id: 'elite', label: 'Elite', minRating: 2200, maxRating: 2399 },
    { id: 'clutch', label: 'CLUTCH', minRating: 2400, maxRating: 99999 },
];
export const DIFFICULTY_IDS = DIFFICULTY_LADDER.map((d) => d.id);
/** Editor telemetry thresholds that trigger anti-cheat review flags. */
export const TELEMETRY_LIMITS = {
    MAX_EVENTS_PER_BATCH: 50,
    MAX_PASTE_COUNT: 5,
    MAX_DROP_COUNT: 3,
};
/** Similarity detection input bounds (defence against DoS via huge inputs). */
export const SIMILARITY_LIMITS = {
    MAX_NORMALIZED_CHARS: 20000,
    SHINGLE_SIZE: 20,
    SAMPLE_STRIDE: 3,
    FLAG_THRESHOLD: 0.85,
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
export const STACK_CATALOG = [
    { id: 'python', name: 'Python', symbol: 'PY', judgeRuntime: 'python' },
    { id: 'javascript', name: 'JavaScript', symbol: 'JS', judgeRuntime: 'javascript' },
    { id: 'typescript', name: 'TypeScript', symbol: 'TS', judgeRuntime: 'typescript' },
    { id: 'java', name: 'Java', symbol: 'JV', judgeRuntime: 'java' },
    { id: 'c', name: 'C', symbol: 'C', judgeRuntime: 'c' },
    { id: 'cpp', name: 'C++', symbol: 'C+', judgeRuntime: 'cpp' },
    { id: 'csharp', name: 'C#', symbol: 'C#', judgeRuntime: 'csharp' },
    { id: 'go', name: 'Go', symbol: 'GO', judgeRuntime: 'go' },
    { id: 'rust', name: 'Rust', symbol: 'RS', judgeRuntime: 'rust' },
    { id: 'php', name: 'PHP', symbol: 'PHP', judgeRuntime: 'php' },
    { id: 'kotlin', name: 'Kotlin', symbol: 'KT', judgeRuntime: 'kotlin' },
    { id: 'swift', name: 'Swift', symbol: 'SW', judgeRuntime: 'swift' },
    { id: 'sql', name: 'SQL', symbol: 'SQL', judgeRuntime: 'sql' },
];
export const STACK_IDS = STACK_CATALOG.map((s) => s.id);
/** Title rarity tiers. Rarity gates nothing about unlock logic — criteria do —
 *  but is used for display ordering and discovery emphasis. */
export const TITLE_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
/**
 * ============================================================================
 * ROOMS
 * ============================================================================
 */
export const ROOM_STATUS = ['open', 'in_progress', 'closed'];
export const ROOM_LIMITS = {
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 16,
    DEFAULT_PLAYERS: 8,
    MIN_TIME_LIMIT_SEC: 60,
    MAX_TIME_LIMIT_SEC: 3600,
    JOIN_CODE_LENGTH: 6,
    MAX_OPEN_ROOMS_PER_HOST: 3,
};
export const QUESTION_SELECTION_MODES = ['random', 'adaptive'];
/**
 * ============================================================================
 * EVENTS & TOURNAMENTS
 * ============================================================================
 */
export const EVENT_STATUSES = ['draft', 'published', 'cancelled', 'completed'];
export const TOURNAMENT_FORMATS = ['single_elimination', 'double_elimination', 'round_robin'];
export const TOURNAMENT_STATUSES = [
    'draft',
    'registration_open',
    'seeding',
    'running',
    'completed',
    'cancelled',
];
export const TOURNAMENT_ROUND_STATUSES = ['pending', 'ready', 'running', 'completed'];
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
export const ADMIN_ROLES = [
    'super_admin',
    'admin',
    'moderator',
    'question_admin',
    'event_admin',
    'tournament_admin',
    'match_moderator',
];
export function isAdminRole(role) {
    return ADMIN_ROLES.includes(role);
}
export const ADMIN_PERMISSIONS = [
    'admin.dashboard.view',
    'admin.matches.view',
    'admin.matches.inspect',
    'admin.matches.adjudicate',
    'admin.questions.create',
    'admin.questions.edit',
    'admin.questions.publish',
    'admin.questions.archive',
    'admin.users.view',
    'admin.users.moderate',
    'admin.security.view',
    'admin.events.create',
    'admin.events.manage',
    'admin.tournaments.manage',
    'admin.titles.manage',
    'admin.audit.view',
];
const ALL_PERMISSIONS = ADMIN_PERMISSIONS;
/**
 * Permission matrix. Note: only SUPER_ADMIN holds `admin.security.view` —
 * ordinary administrators must NOT automatically access security-sensitive
 * data (IPs, session metadata).
 */
export const ROLE_PERMISSIONS = {
    super_admin: ALL_PERMISSIONS,
    admin: ALL_PERMISSIONS.filter((p) => p !== 'admin.security.view'),
    moderator: [
        'admin.dashboard.view',
        'admin.matches.view',
        'admin.matches.inspect',
        'admin.users.view',
        'admin.audit.view',
    ],
    question_admin: [
        'admin.dashboard.view',
        'admin.questions.create',
        'admin.questions.edit',
        'admin.questions.publish',
        'admin.questions.archive',
        'admin.audit.view',
    ],
    event_admin: ['admin.dashboard.view', 'admin.events.create', 'admin.events.manage'],
    tournament_admin: ['admin.dashboard.view', 'admin.tournaments.manage'],
    match_moderator: [
        'admin.dashboard.view',
        'admin.matches.view',
        'admin.matches.inspect',
        'admin.matches.adjudicate',
        'admin.users.view',
        'admin.audit.view',
    ],
};
/** Server-side authorization check. Regular users hold no permissions. */
export function hasPermission(role, permission) {
    if (!isAdminRole(role))
        return false;
    return ROLE_PERMISSIONS[role].includes(permission);
}
//# sourceMappingURL=constants.js.map