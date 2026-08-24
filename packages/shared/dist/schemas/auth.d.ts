import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    handle: z.ZodString;
    region: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    handle: string;
    region: string;
}, {
    email: string;
    password: string;
    handle: string;
    region?: string | undefined;
}>;
/**
 * The identifier field accepts an email address OR a public handle.
 * Ambiguity is resolved server-side ('@' ⇒ email); error responses never
 * reveal which identifiers exist.
 */
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
//# sourceMappingURL=auth.d.ts.map