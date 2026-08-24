import { z } from 'zod'

export const createEventSchema = z.object({
  slug: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(3).max(120),
  descriptionMd: z.string().max(8000).optional(),
  rulesMd: z.string().max(8000).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  stackIds: z.array(z.string().min(1).max(32)).min(1),
  allowedDifficultyIds: z.array(z.string().min(2).max(24)).min(1),
  maxParticipants: z.number().int().min(2).max(100000).nullable().default(null),
  rewardTitleCodes: z.array(z.string().min(1).max(64)).max(8).default([]),
})

export type CreateEventInput = z.infer<typeof createEventSchema>

export const eventSlugParamsSchema = z.object({ slug: z.string().min(3).max(64) })

export const listEventsQuerySchema = z.object({
  phase: z.enum(['upcoming', 'active', 'ended', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
})

/**
 * Authoritative event phase derived ONLY from server wall-clock time and the
 * stored publish status. Clients never compute or fake these phases.
 */
export function eventPhase(
  now: Date,
  event: { startsAt: Date; endsAt: Date },
): 'upcoming' | 'active' | 'ended' {
  if (now < event.startsAt) return 'upcoming'
  if (now >= event.endsAt) return 'ended'
  return 'active'
}

/** Deterministic registration window check (server time only). */
export function canRegisterForEvent(
  now: Date,
  event: { startsAt: Date; endsAt: Date },
): { ok: true } | { ok: false; reason: string } {
  if (now >= event.endsAt) return { ok: false, reason: 'This event has ended' }
  return { ok: true }
}
