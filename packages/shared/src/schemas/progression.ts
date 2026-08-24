import { z } from 'zod'
import { TELEMETRY_LIMITS } from '../constants.js'

/** Client-reported editor telemetry for anti-cheat analysis. Never trusted
 *  as proof of cheating on its own — it only feeds server-side review flags. */
export const editorTelemetrySchema = z.object({
  events: z
    .array(
      z.object({
        kind: z.enum(['paste', 'drop', 'copy', 'blur', 'focus']),
        atMs: z.number().int().min(0).max(10 * 60 * 60 * 1000),
        length: z.number().int().min(0).max(100000).optional(),
      }),
    )
    .max(TELEMETRY_LIMITS.MAX_EVENTS_PER_BATCH),
})

export type EditorTelemetryInput = z.infer<typeof editorTelemetrySchema>

export const publicProfileSchema = z.object({
  handle: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
})

// Avatars: URL must be http(s), bounded length. We never fetch avatars
// server-side (no SSRF surface); the URL is only rendered by browsers.
export const secureAvatarUrl = z
  .string()
  .url()
  .max(512)
  .refine((v) => /^https?:\/\//i.test(v), 'Avatar URL must be http(s)')

export const updateProfileSchemaWithSecureAvatar = z.object({
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
})
