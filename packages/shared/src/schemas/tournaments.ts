import { z } from 'zod'
import { TOURNAMENT_FORMATS } from '../constants.js'

export const createTournamentSchema = z.object({
  slug: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(3).max(120),
  descriptionMd: z.string().max(8000).optional(),
  format: z.enum(TOURNAMENT_FORMATS).default('single_elimination'),
  stackId: z.string().min(1).max(32),
  maxParticipants: z.number().int().min(4).max(1024),
  registrationOpensAt: z.coerce.date(),
  registrationClosesAt: z.coerce.date(),
  startsAt: z.coerce.date(),
})

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>

export const tournamentSlugParamsSchema = z.object({ slug: z.string().min(3).max(64) })

/**
 * Pure, deterministic registration eligibility check. The window is evaluated
 * against SERVER time only; capacity against the stored participant cap.
 */
export function canRegisterForTournament(
  now: Date,
  tournament: {
    status: string
    registrationOpensAt: Date
    registrationClosesAt: Date
    startsAt: Date
    maxParticipants: number
    registeredCount: number
  },
): { ok: true } | { ok: false; reason: string } {
  if (tournament.status !== 'registration_open') {
    return { ok: false, reason: 'Registration is not open for this tournament' }
  }
  if (now < tournament.registrationOpensAt) {
    return { ok: false, reason: 'Registration has not opened yet' }
  }
  if (now >= tournament.registrationClosesAt) {
    return { ok: false, reason: 'Registration has closed' }
  }
  if (tournament.registeredCount >= tournament.maxParticipants) {
    return { ok: false, reason: 'This tournament is full' }
  }
  return { ok: true }
}
