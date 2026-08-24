import { z } from 'zod';
export declare const queueJoinSchema: z.ZodObject<{
    stackId: z.ZodString;
    difficultyId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    stackId: string;
    difficultyId?: string | undefined;
}, {
    stackId: string;
    difficultyId?: string | undefined;
}>;
export type QueueJoinInput = z.infer<typeof queueJoinSchema>;
//# sourceMappingURL=queue.d.ts.map