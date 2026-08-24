import { z } from 'zod';
export declare const updateProfileSchema: z.ZodObject<{
    handle: z.ZodOptional<z.ZodString>;
    displayName: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    handle?: string | undefined;
    region?: string | undefined;
    displayName?: string | undefined;
    bio?: string | undefined;
    avatarUrl?: string | undefined;
}, {
    handle?: string | undefined;
    region?: string | undefined;
    displayName?: string | undefined;
    bio?: string | undefined;
    avatarUrl?: string | undefined;
}>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
/** First-time onboarding completion. The primary stack is a preference for
 *  queue pre-selection; competitive initialization stays server-side. */
export declare const completeOnboardingSchema: z.ZodObject<{
    primaryStackId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    primaryStackId: string;
}, {
    primaryStackId: string;
}>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
//# sourceMappingURL=profile.d.ts.map