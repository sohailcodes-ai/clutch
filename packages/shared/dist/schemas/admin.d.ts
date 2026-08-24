import { z } from 'zod';
/**
 * Admin question management contracts. Authorization is enforced server-side
 * via the `requireAdmin` middleware; these schemas only validate payloads.
 */
export declare const updateQuestionMetaSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    descriptionMd: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    difficultyId: z.ZodOptional<z.ZodString>;
    topic: z.ZodOptional<z.ZodString>;
    topicIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    stackIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    timeLimitSec: z.ZodOptional<z.ZodNumber>;
    memoryLimitMb: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    descriptionMd?: string | null | undefined;
    difficultyId?: string | undefined;
    timeLimitSec?: number | undefined;
    stackIds?: string[] | undefined;
    title?: string | undefined;
    topic?: string | undefined;
    topicIds?: string[] | undefined;
    tags?: string[] | undefined;
    memoryLimitMb?: number | undefined;
}, {
    descriptionMd?: string | null | undefined;
    difficultyId?: string | undefined;
    timeLimitSec?: number | undefined;
    stackIds?: string[] | undefined;
    title?: string | undefined;
    topic?: string | undefined;
    topicIds?: string[] | undefined;
    tags?: string[] | undefined;
    memoryLimitMb?: number | undefined;
}>;
export type UpdateQuestionMetaInput = z.infer<typeof updateQuestionMetaSchema>;
/** Creating new content always produces a NEW immutable version. */
export declare const createQuestionVersionSchema: z.ZodObject<{
    promptMd: z.ZodString;
    examples: z.ZodDefault<z.ZodArray<z.ZodObject<{
        input: z.ZodString;
        output: z.ZodString;
        explanation: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        input: string;
        output: string;
        explanation?: string | undefined;
    }, {
        input: string;
        output: string;
        explanation?: string | undefined;
    }>, "many">>;
    starterCode: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    constraints: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    promptMd: string;
    examples: {
        input: string;
        output: string;
        explanation?: string | undefined;
    }[];
    starterCode: Record<string, string>;
    constraints: Record<string, unknown>;
}, {
    promptMd: string;
    examples?: {
        input: string;
        output: string;
        explanation?: string | undefined;
    }[] | undefined;
    starterCode?: Record<string, string> | undefined;
    constraints?: Record<string, unknown> | undefined;
}>;
export type CreateQuestionVersionInput = z.infer<typeof createQuestionVersionSchema>;
export declare const addTestCasesSchema: z.ZodObject<{
    testCases: z.ZodArray<z.ZodObject<{
        visibility: z.ZodEnum<["public", "hidden"]>;
        input: z.ZodString;
        expectedOutput: z.ZodString;
        weight: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        input: string;
        visibility: "public" | "hidden";
        expectedOutput: string;
        weight: number;
    }, {
        input: string;
        visibility: "public" | "hidden";
        expectedOutput: string;
        weight?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    testCases: {
        input: string;
        visibility: "public" | "hidden";
        expectedOutput: string;
        weight: number;
    }[];
}, {
    testCases: {
        input: string;
        visibility: "public" | "hidden";
        expectedOutput: string;
        weight?: number | undefined;
    }[];
}>;
export type AddTestCasesInput = z.infer<typeof addTestCasesSchema>;
export declare const listAdminQuestionsQuerySchema: z.ZodObject<{
    status: z.ZodDefault<z.ZodEnum<["draft", "published", "retired", "all"]>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "published" | "all" | "retired";
    limit: number;
    offset: number;
}, {
    status?: "draft" | "published" | "all" | "retired" | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const questionIdParamsSchema: z.ZodObject<{
    questionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    questionId: string;
}, {
    questionId: string;
}>;
export declare const questionVersionParamsSchema: z.ZodObject<{
    questionId: z.ZodString;
    versionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    questionId: string;
    versionId: string;
}, {
    questionId: string;
    versionId: string;
}>;
/** Public-safe question usage stats for admins (no hidden test content). */
export declare const questionStatsSchema: z.ZodObject<{
    timesUsedInMatches: z.ZodNumber;
    submissions: z.ZodNumber;
    acceptedSubmissions: z.ZodNumber;
    passRate: z.ZodNumber;
    averageSolveTimeMs: z.ZodNullable<z.ZodNumber>;
    distinctSolvers: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    timesUsedInMatches: number;
    submissions: number;
    acceptedSubmissions: number;
    passRate: number;
    averageSolveTimeMs: number | null;
    distinctSolvers: number;
}, {
    timesUsedInMatches: number;
    submissions: number;
    acceptedSubmissions: number;
    passRate: number;
    averageSolveTimeMs: number | null;
    distinctSolvers: number;
}>;
export type QuestionStats = z.infer<typeof questionStatsSchema>;
//# sourceMappingURL=admin.d.ts.map