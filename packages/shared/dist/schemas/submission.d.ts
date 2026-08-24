import { z } from 'zod';
export declare const submissionSchema: z.ZodObject<{
    sourceCode: z.ZodString;
    language: z.ZodEnum<["typescript", "python", "rust", "cpp", "go", "java"]>;
    idempotencyKey: z.ZodString;
    isFinal: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    sourceCode: string;
    language: "typescript" | "python" | "rust" | "cpp" | "go" | "java";
    idempotencyKey: string;
    isFinal: boolean;
}, {
    sourceCode: string;
    language: "typescript" | "python" | "rust" | "cpp" | "go" | "java";
    idempotencyKey: string;
    isFinal?: boolean | undefined;
}>;
export type SubmissionInput = z.infer<typeof submissionSchema>;
//# sourceMappingURL=submission.d.ts.map