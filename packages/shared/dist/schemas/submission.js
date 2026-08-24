import { z } from 'zod';
export const submissionSchema = z.object({
    sourceCode: z.string().min(1).max(65536),
    language: z.enum(['typescript', 'python', 'rust', 'cpp', 'go', 'java']),
    idempotencyKey: z.string().min(8).max(128),
    isFinal: z.boolean().default(false),
});
//# sourceMappingURL=submission.js.map