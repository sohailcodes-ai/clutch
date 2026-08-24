import type { DbExecutor } from '@clutch/db';
import { type TitleRarity } from '@clutch/shared';
/**
 * Data-driven title/badge system.
 *
 * Titles are defined as ROWS in the `titles` table with a JSON criteria
 * document. Criteria types supported by the evaluator below form a small,
 * closed, server-authoritative vocabulary. The client can display awards but
 * can NEVER create, trigger or unlock them — every unlock flows through
 * `evaluateAndAwardTitles`, which derives facts exclusively from PostgreSQL.
 *
 * Supported criteria shapes:
 *   { "type": "wins",           "value": 10 }
 *   { "type": "matches",        "value": 25 }
 *   { "type": "draws",          "value": 5 }
 *   { "type": "rating",         "value": 2400, "stackId": "optional" }
 *   { "type": "win_streak",     "value": 5 }
 *   { "type": "unique_solved",  "value": 50 }
 *   { "type": "stacks_won",     "value": 3 }
 *   { "type": "difficulty_climb", "value": 3 }
 *   { "type": "top_rank",       "value": 100 }
 *   { "type": "fast_win",       "value": 60000 }   // ms
 *   { "type": "comeback" }                          // won from behind
 *   { "type": "first_blood_fast", "value": 60000 }  // ms
 *   { "type": "first_blood" }
 */
export type TitleCriteria = {
    type: 'wins';
    value: number;
} | {
    type: 'matches';
    value: number;
} | {
    type: 'draws';
    value: number;
} | {
    type: 'rating';
    value: number;
    stackId?: string;
} | {
    type: 'win_streak';
    value: number;
} | {
    type: 'unique_solved';
    value: number;
} | {
    type: 'stacks_won';
    value: number;
} | {
    type: 'difficulty_climb';
    value: number;
} | {
    type: 'top_rank';
    value: number;
} | {
    type: 'fast_win';
    value: number;
} | {
    type: 'first_blood';
} | {
    type: 'comeback';
} | {
    type: 'first_blood_fast';
    value: number;
};
export declare function isTitleCriteria(value: unknown): value is TitleCriteria;
/** Aggregated competitive facts about a user — all derived from PostgreSQL. */
export type CompetitiveFacts = {
    wins: number;
    losses: number;
    draws: number;
    matches: number;
    peakRating: number;
    firstBloods: number;
    /** Current consecutive-win run across ranked matches (most recent first). */
    currentWinStreak: number;
    /** Best consecutive-win run ever. */
    bestWinStreak: number;
    /** Distinct questions with at least one accepted outcome. */
    uniqueSolved: number;
    /** Distinct stacks with at least one win. */
    stacksWon: number;
    /** Distinct difficulty bands the user has solved something in. */
    difficultiesSolved: number;
    /** Best global rank ever observed at evaluation time (null = unranked). */
    globalRank: number | null;
    /** Fastest fully-accepted winning submission, in ms (null = none). */
    fastestWinMs: number | null;
    /** Wins after having failed an earlier submission in the same match. */
    comebackWins: number;
};
export declare const EMPTY_FACTS: CompetitiveFacts;
/** Pure criteria evaluation — unit-testable, deterministic. */
export declare function evaluateCriteria(criteria: TitleCriteria, facts: CompetitiveFacts): boolean;
/**
 * Deterministic progress toward a criteria threshold. Returns null for
 * boolean criteria that cannot express partial progress.
 */
export declare function titleProgress(criteria: TitleCriteria, facts: CompetitiveFacts): {
    current: number;
    target: number;
} | null;
export declare function getCompetitiveFacts(db: DbExecutor, userId: string): Promise<CompetitiveFacts>;
/**
 * Evaluates every active title against the user's facts and inserts any newly
 * earned ones. Idempotent via unique(user_id, title_id). Runs inside an
 * optional caller transaction.
 */
export declare function evaluateAndAwardTitles(db: DbExecutor, userId: string, matchId?: string): Promise<{
    code: string;
    name: string;
}[]>;
export declare function getUserAwards(db: DbExecutor, userId: string): Promise<{
    id: string;
    userId: string;
    matchId: string | null;
    titleId: string;
    awardedAt: Date;
    title: {
        id: string;
        createdAt: Date;
        name: string;
        description: string;
        isActive: boolean;
        sortOrder: number;
        code: string;
        kind: string;
        icon: string | null;
        rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
        isSecret: boolean;
        criteria: unknown;
    };
}[]>;
export declare function listActiveTitles(db: DbExecutor): Promise<{
    id: string;
    createdAt: Date;
    name: string;
    description: string;
    isActive: boolean;
    sortOrder: number;
    code: string;
    kind: string;
    icon: string | null;
    rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
    isSecret: boolean;
    criteria: unknown;
}[]>;
/** The shape returned to clients — locked secrets never expose criteria. */
export type CatalogEntry = {
    code: string;
    name: string;
    description: string | null;
    rarity: TitleRarity;
    kind: string;
    icon: string | null;
    unlocked: boolean;
    awardedAt: string | null;
    isSecret: boolean;
    progress: {
        current: number;
        target: number;
    } | null;
};
/**
 * Full discovery view: every active title, unlocked state and progress toward
 * unlock. Secret titles that are still locked collapse to
 * "???" / "Secret Achievement" and hide their condition.
 */
export declare function getTitleCatalogForUser(db: DbExecutor, userId: string): Promise<CatalogEntry[]>;
/** Equip ONE owned title (or unequip with null). Server-side ownership check. */
export declare function equipTitle(db: DbExecutor, userId: string, titleCode: string | null): Promise<{
    equipped: CatalogEntry | null;
}>;
//# sourceMappingURL=service.d.ts.map