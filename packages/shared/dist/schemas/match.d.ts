import { z } from 'zod';
export declare const matchReadySchema: z.ZodObject<{
    idempotencyKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    idempotencyKey: string;
}, {
    idempotencyKey: string;
}>;
export declare const matchSubmitSchema: z.ZodObject<{
    sourceCode: z.ZodString;
    idempotencyKey: z.ZodString;
    isFinal: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    idempotencyKey: string;
    sourceCode: string;
    isFinal: boolean;
}, {
    idempotencyKey: string;
    sourceCode: string;
    isFinal?: boolean | undefined;
}>;
export type MatchReadyInput = z.infer<typeof matchReadySchema>;
export type MatchSubmitInput = z.infer<typeof matchSubmitSchema>;
//# sourceMappingURL=match.d.ts.map