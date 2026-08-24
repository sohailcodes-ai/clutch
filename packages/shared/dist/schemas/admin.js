import { z } from 'zod';
/**
 * Admin question management contracts. Authorization is enforced server-side
 * via the `requireAdmin` middleware; these schemas only validate payloads.
 */
export const updateQuestionMetaSchema = z.object({
    title: z.string().min(3).max(200).optional(),
    descriptionMd: z.string().max(8000).nullable().optional(),
    difficultyId: z.string().min(2).max(24).optional(),
    topic: z.string().min(2).max(48).optional(),
    topicIds: z.array(z.string().uuid()).max(12).optional(),
    stackIds: z.array(z.string().min(1).max(32)).min(1).optional(),
    tags: z.array(z.string().min(1).max(32)).max(12).optional(),
    timeLimitSec: z.number().int().min(30).max(3600).optional(),
    memoryLimitMb: z.number().int().min(32).max(1024).optional(),
});
/** Creating new content always produces a NEW immutable version. */
export const createQuestionVersionSchema = z.object({
    promptMd: z.string().min(10),
    examples: z
        .array(z.object({
        input: z.string().max(2000),
        output: z.string().max(2000),
        explanation: z.string().max(2000).optional(),
    }))
        .max(6)
        .default([]),
    starterCode: z.record(z.string()).default({}),
    constraints: z.record(z.unknown()).default({}),
});
export const addTestCasesSchema = z.object({
    testCases: z.array(z.object({
        visibility: z.enum(['public', 'hidden']),
        input: z.string(),
        expectedOutput: z.string(),
        weight: z.number().int().min(1).default(1),
    })).min(1),
});
export const listAdminQuestionsQuerySchema = z.object({
    status: z.enum(['draft', 'published', 'retired', 'all']).default('all'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
});
export const questionIdParamsSchema = z.object({ questionId: z.string().uuid() });
export const questionVersionParamsSchema = z.object({
    questionId: z.string().uuid(),
    versionId: z.string().uuid(),
});
/** Public-safe question usage stats for admins (no hidden test content). */
export const questionStatsSchema = z.object({
    timesUsedInMatches: z.number().int(),
    submissions: z.number().int(),
    acceptedSubmissions: z.number().int(),
    passRate: z.number(),
    averageSolveTimeMs: z.number().nullable(),
    distinctSolvers: z.number().int(),
});
//# sourceMappingURL=admin.js.map