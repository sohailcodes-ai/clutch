import { z } from 'zod';
export declare const createQuestionSchema: z.ZodObject<{
    slug: z.ZodString;
    title: z.ZodString;
    descriptionMd: z.ZodOptional<z.ZodString>;
    difficultyId: z.ZodString;
    topic: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    timeLimitSec: z.ZodDefault<z.ZodNumber>;
    memoryLimitMb: z.ZodDefault<z.ZodNumber>;
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
    stackIds: z.ZodArray<z.ZodString, "many">;
    source: z.ZodDefault<z.ZodEnum<["clutch-original", "public-domain", "cc-by", "licensed"]>>;
    license: z.ZodOptional<z.ZodString>;
    attribution: z.ZodOptional<z.ZodString>;
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
    slug: string;
    title: string;
    difficultyId: string;
    topic: string;
    tags: string[];
    timeLimitSec: number;
    memoryLimitMb: number;
    promptMd: string;
    examples: {
        input: string;
        output: string;
        explanation?: string | undefined;
    }[];
    starterCode: Record<string, string>;
    stackIds: string[];
    source: "clutch-original" | "public-domain" | "cc-by" | "licensed";
    testCases: {
        input: string;
        visibility: "public" | "hidden";
        expectedOutput: string;
        weight: number;
    }[];
    descriptionMd?: string | undefined;
    license?: string | undefined;
    attribution?: string | undefined;
}, {
    slug: string;
    title: string;
    difficultyId: string;
    topic: string;
    promptMd: string;
    stackIds: string[];
    testCases: {
        input: string;
        visibility: "public" | "hidden";
        expectedOutput: string;
        weight?: number | undefined;
    }[];
    descriptionMd?: string | undefined;
    tags?: string[] | undefined;
    timeLimitSec?: number | undefined;
    memoryLimitMb?: number | undefined;
    examples?: {
        input: string;
        output: string;
        explanation?: string | undefined;
    }[] | undefined;
    starterCode?: Record<string, string> | undefined;
    source?: "clutch-original" | "public-domain" | "cc-by" | "licensed" | undefined;
    license?: string | undefined;
    attribution?: string | undefined;
}>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export declare const listQuestionsQuerySchema: z.ZodObject<{
    stackId: z.ZodOptional<z.ZodString>;
    topic: z.ZodOptional<z.ZodString>;
    difficultyId: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    difficultyId?: string | undefined;
    topic?: string | undefined;
    stackId?: string | undefined;
}, {
    difficultyId?: string | undefined;
    topic?: string | undefined;
    stackId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;
//# sourceMappingURL=question.d.ts.map