import { z } from 'zod';
export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    handle: z
        .string()
        .min(3)
        .max(24)
        .regex(/^[a-zA-Z0-9_]+$/),
    region: z.string().min(2).max(16).default('global'),
});
/**
 * The identifier field accepts an email address OR a public handle.
 * Ambiguity is resolved server-side ('@' ⇒ email); error responses never
 * reveal which identifiers exist.
 */
export const loginSchema = z.object({
    email: z.string().min(3).max(128),
    password: z.string().min(1),
});
//# sourceMappingURL=auth.js.map