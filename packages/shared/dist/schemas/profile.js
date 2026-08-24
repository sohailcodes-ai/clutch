import { z } from 'zod';
// Avatars must be http(s) URLs, bounded length. The server never fetches
// avatar URLs (no SSRF surface) — they are only rendered by browsers.
const secureAvatarUrl = z
    .string()
    .url()
    .max(512)
    .refine((v) => /^https?:\/\//i.test(v), 'Avatar URL must be http(s)');
export const updateProfileSchema = z.object({
    handle: z
        .string()
        .min(3)
        .max(24)
        .regex(/^[a-zA-Z0-9_]+$/)
        .optional(),
    displayName: z.string().min(1).max(64).optional(),
    region: z.string().min(2).max(16).optional(),
    bio: z.string().max(500).optional(),
    avatarUrl: secureAvatarUrl.optional(),
});
/** First-time onboarding completion. The primary stack is a preference for
 *  queue pre-selection; competitive initialization stays server-side. */
export const completeOnboardingSchema = z.object({
    primaryStackId: z.string().min(1).max(32),
});
//# sourceMappingURL=profile.js.map