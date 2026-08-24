import type { Database, DbExecutor } from '@clutch/db';
import { schema } from '@clutch/db';
import { type CreateQuestionInput, type CreateQuestionVersionInput, type UpdateQuestionMetaInput } from '@clutch/shared';
/** A question may only enter a match when published AND evaluable. */
export declare function isSelectableCandidate(q: {
    status: string;
    versions: {
        testCases: unknown[];
    }[];
}): boolean;
/**
 * Band walk order for pool balancing: preferred band first, then adjacent
 * bands alternating outward (target-1, target+1, target-2, ...). Guarantees
 * matchmaking never deadlocks on an empty difficulty bucket while staying as
 * close to the requested difficulty as possible.
 */
export declare function bandWalkOrder(sortOrders: number[], targetSortOrder: number): number[];
/**
 * Deterministic per-pair jitter. Same inputs always produce the same value,
 * but different pairs see different orderings so users cannot predict or
 * farm a fixed question queue. FNV-1a based, bounded to [0, 1).
 */
export declare function pairJitter(seedParts: string[], slug: string): number;
export type CandidateScoreInput = {
    slug: string;
    bandSortOrder: number;
    targetSortOrder: number;
    timesSeen: number;
};
/**
 * Scoring: prefer the target difficulty, penalize recently seen questions,
 * break ties with bounded pair-specific jitter. Higher score wins.
 */
export declare function scoreCandidate(c: CandidateScoreInput, jitterSeed: string[]): number;
/** Deterministic winner selection from scored candidates. */
export declare function pickBest<T extends {
    slug: string;
    timesSeen: number;
    bandSortOrder: number;
}>(pool: readonly T[], targetSortOrder: number, jitterSeed: string[]): T | null;
/** Creates an admin-owned DRAFT question with its initial (unpublished) v1. */
export declare function createQuestionDraft(db: Database, input: CreateQuestionInput): Promise<{
    question: {
        id: string;
        status: "draft" | "published" | "retired";
        createdAt: Date;
        title: string;
        slug: string;
        descriptionMd: string | null;
        difficultyId: string;
        topic: string;
        tags: unknown;
        source: string;
        license: string | null;
        attribution: string | null;
        timeLimitSec: number;
        memoryLimitMb: number;
    };
    version: {
        id: string;
        questionId: string;
        version: number;
        promptMd: string;
        examples: unknown;
        starterCode: unknown;
        constraints: unknown;
        publishedAt: Date | null;
    };
}>;
/** Legacy direct-publish creation kept for compatibility with existing flows. */
export declare function createQuestion(db: Database, input: CreateQuestionInput): Promise<{
    question: {
        id: string;
        status: "draft" | "published" | "retired";
        createdAt: Date;
        title: string;
        slug: string;
        descriptionMd: string | null;
        difficultyId: string;
        topic: string;
        tags: unknown;
        source: string;
        license: string | null;
        attribution: string | null;
        timeLimitSec: number;
        memoryLimitMb: number;
    };
    version: {
        id: string;
        questionId: string;
        version: number;
        promptMd: string;
        examples: unknown;
        starterCode: unknown;
        constraints: unknown;
        publishedAt: Date | null;
    };
}>;
/**
 * Update editable metadata. Content changes must go through
 * `upsertDraftContent`, which preserves the immutability of published
 * versions by creating a new version instead.
 */
export declare function updateQuestionMeta(db: Database, questionId: string, input: UpdateQuestionMetaInput): Promise<{
    id: string;
    slug: string;
    title: string;
    descriptionMd: string | null;
    difficultyId: string;
    topic: string;
    tags: unknown;
    source: string;
    license: string | null;
    attribution: string | null;
    timeLimitSec: number;
    memoryLimitMb: number;
    status: "draft" | "published" | "retired";
    createdAt: Date;
} | undefined>;
/**
 * Content authoring. While a question is a DRAFT its latest version is edited
 * in place (it can never be referenced by a match). Once PUBLISHED, any
 * content change creates a NEW immutable version — active matches keep their
 * original version forever.
 */
export declare function upsertDraftContent(db: Database, questionId: string, content: CreateQuestionVersionInput): Promise<{
    id: string;
    questionId: string;
    version: number;
    promptMd: string;
    examples: unknown;
    starterCode: unknown;
    constraints: unknown;
    publishedAt: Date | null;
}>;
/** Adds test cases to the LATEST version. Rejected once that version is live
 *  in any match — hidden tests must be authored before publishing. */
export declare function addTestCasesToLatestVersion(db: Database, questionId: string, tests: AddTestCaseRow[]): Promise<void>;
export type AddTestCaseRow = {
    visibility: 'public' | 'hidden';
    input: string;
    expectedOutput: string;
    weight: number;
};
/** Draft/released transition. Publishing stamps the latest version. */
export declare function publishQuestion(db: Database, questionId: string): Promise<{
    id: string;
    slug: string;
    title: string;
    descriptionMd: string | null;
    difficultyId: string;
    topic: string;
    tags: unknown;
    source: string;
    license: string | null;
    attribution: string | null;
    timeLimitSec: number;
    memoryLimitMb: number;
    status: "draft" | "published" | "retired";
    createdAt: Date;
} | undefined>;
export declare function unpublishQuestion(db: Database, questionId: string): Promise<{
    id: string;
    slug: string;
    title: string;
    descriptionMd: string | null;
    difficultyId: string;
    topic: string;
    tags: unknown;
    source: string;
    license: string | null;
    attribution: string | null;
    timeLimitSec: number;
    memoryLimitMb: number;
    status: "draft" | "published" | "retired";
    createdAt: Date;
}>;
export declare function archiveQuestion(db: Database, questionId: string): Promise<{
    id: string;
    slug: string;
    title: string;
    descriptionMd: string | null;
    difficultyId: string;
    topic: string;
    tags: unknown;
    source: string;
    license: string | null;
    attribution: string | null;
    timeLimitSec: number;
    memoryLimitMb: number;
    status: "draft" | "published" | "retired";
    createdAt: Date;
}>;
export declare function listQuestionsForAdmin(db: DbExecutor, opts: {
    status?: 'draft' | 'published' | 'retired' | 'all';
    limit: number;
    offset: number;
}): Promise<{
    id: string;
    status: "draft" | "published" | "retired";
    createdAt: Date;
    title: string;
    slug: string;
    descriptionMd: string | null;
    difficultyId: string;
    topic: string;
    tags: unknown;
    source: string;
    license: string | null;
    attribution: string | null;
    timeLimitSec: number;
    memoryLimitMb: number;
    versions: {
        id: string;
        version: number;
        publishedAt: Date | null;
    }[];
    stackSupport: {
        stackId: string;
        questionId: string;
    }[];
}[]>;
/** Usage/pass-rate/solve-time analytics. Contains NO hidden test content. */
export declare function getQuestionStats(db: DbExecutor, questionId: string): Promise<{
    timesUsedInMatches: number;
    submissions: number;
    acceptedSubmissions: number;
    passRate: number;
    averageSolveTimeMs: number | null;
    distinctSolvers: number;
}>;
export type SelectOptions = {
    /** Queue-entry difficulty preference (validated against DB bands). */
    preferredDifficultyId?: string | null;
};
type Band = typeof schema.difficultyBands.$inferSelect;
/** Deterministic adaptive band choice from ratings + recent accuracy. */
export declare function chooseTargetBandIndex(bandCount: number, baseIndex: number, userAccuracies: number[]): number;
export declare function selectQuestionForMatch(db: Database, stackId: string, avgRating: number, userIds: [string, string], options?: SelectOptions): Promise<{
    question: {
        timesSeen: number;
        bandSortOrder: number;
        id: string;
        status: "draft" | "published" | "retired";
        createdAt: Date;
        title: string;
        slug: string;
        descriptionMd: string | null;
        difficultyId: string;
        topic: string;
        tags: unknown;
        source: string;
        license: string | null;
        attribution: string | null;
        timeLimitSec: number;
        memoryLimitMb: number;
        versions: {
            id: string;
            questionId: string;
            version: number;
            promptMd: string;
            examples: unknown;
            starterCode: unknown;
            constraints: unknown;
            publishedAt: Date | null;
            testCases: {
                id: string;
                memoryLimitMb: number | null;
                questionVersionId: string;
                ordinal: number;
                visibility: "public" | "hidden";
                input: string;
                expectedOutput: string;
                weight: number;
                timeLimitMs: number | null;
            }[];
        }[];
    };
    version: {
        id: string;
        questionId: string;
        version: number;
        promptMd: string;
        examples: unknown;
        starterCode: unknown;
        constraints: unknown;
        publishedAt: Date | null;
        testCases: {
            id: string;
            memoryLimitMb: number | null;
            questionVersionId: string;
            ordinal: number;
            visibility: "public" | "hidden";
            input: string;
            expectedOutput: string;
            weight: number;
            timeLimitMs: number | null;
        }[];
    };
    difficultyId: string;
} | null>;
export declare function getQuestionForEditor(db: Database, questionVersionId: string): Promise<{
    testCases: {
        id: string;
        memoryLimitMb: number | null;
        questionVersionId: string;
        ordinal: number;
        visibility: "public" | "hidden";
        input: string;
        expectedOutput: string;
        weight: number;
        timeLimitMs: number | null;
    }[];
    id: string;
    questionId: string;
    version: number;
    promptMd: string;
    examples: unknown;
    starterCode: unknown;
    constraints: unknown;
    publishedAt: Date | null;
    question: {
        id: string;
        status: "draft" | "published" | "retired";
        createdAt: Date;
        title: string;
        slug: string;
        descriptionMd: string | null;
        difficultyId: string;
        topic: string;
        tags: unknown;
        source: string;
        license: string | null;
        attribution: string | null;
        timeLimitSec: number;
        memoryLimitMb: number;
    };
} | null>;
export type { Band };
//# sourceMappingURL=service.d.ts.map