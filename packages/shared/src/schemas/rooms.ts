import { z } from 'zod'
import {
  QUESTION_SELECTION_MODES,
  ROOM_LIMITS,
  ROOM_STATUS,
} from '../constants.js'

/** Server-side validation for competitive room configuration. */
export const createRoomSchema = z.object({
  name: z.string().min(3).max(64).trim(),
  description: z.string().max(500).optional(),
  stackId: z.string().min(1).max(32),
  difficultyId: z.string().min(2).max(24).nullable().default(null),
  maxPlayers: z
    .number()
    .int()
    .min(ROOM_LIMITS.MIN_PLAYERS)
    .max(ROOM_LIMITS.MAX_PLAYERS)
    .default(ROOM_LIMITS.DEFAULT_PLAYERS),
  isPublic: z.boolean().default(true),
  ranked: z.boolean().default(false),
  timeLimitSec: z
    .number()
    .int()
    .min(ROOM_LIMITS.MIN_TIME_LIMIT_SEC)
    .max(ROOM_LIMITS.MAX_TIME_LIMIT_SEC)
    .default(900),
  questionSelectionMode: z.enum(QUESTION_SELECTION_MODES).default('adaptive'),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>

export const updateRoomSchema = z.object({
  name: z.string().min(3).max(64).trim().optional(),
  description: z.string().max(500).optional(),
  difficultyId: z.string().min(2).max(24).nullable().optional(),
  maxPlayers: z
    .number()
    .int()
    .min(ROOM_LIMITS.MIN_PLAYERS)
    .max(ROOM_LIMITS.MAX_PLAYERS)
    .optional(),
  ranked: z.boolean().optional(),
  timeLimitSec: z
    .number()
    .int()
    .min(ROOM_LIMITS.MIN_TIME_LIMIT_SEC)
    .max(ROOM_LIMITS.MAX_TIME_LIMIT_SEC)
    .optional(),
  questionSelectionMode: z.enum(QUESTION_SELECTION_MODES).optional(),
})

export type UpdateRoomInput = z.infer<typeof updateRoomSchema>

export const joinRoomSchema = z.object({
  joinCode: z.string().length(ROOM_LIMITS.JOIN_CODE_LENGTH).optional(),
})

export const roomIdParamsSchema = z.object({ roomId: z.string().uuid() })

export const listRoomsQuerySchema = z.object({
  status: z.enum(ROOM_STATUS).default('open'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
})

/**
 * Pure structural validation of room configuration, independent of the DB.
 * Used by the domain service before any persistence happens.
 */
export function validateRoomConfig(config: CreateRoomInput): { ok: true } | { ok: false; reason: string } {
  if (config.maxPlayers < ROOM_LIMITS.MIN_PLAYERS || config.maxPlayers > ROOM_LIMITS.MAX_PLAYERS) {
    return {
      ok: false,
      reason: `Player slots must be between ${ROOM_LIMITS.MIN_PLAYERS} and ${ROOM_LIMITS.MAX_PLAYERS}`,
    }
  }
  if (config.timeLimitSec < ROOM_LIMITS.MIN_TIME_LIMIT_SEC) {
    return { ok: false, reason: 'Time limit is too short' }
  }
  if (config.timeLimitSec > ROOM_LIMITS.MAX_TIME_LIMIT_SEC) {
    return { ok: false, reason: 'Time limit is too long' }
  }
  // Private rooms MUST have an access mechanism (join code is provisioned
  // server-side at creation if missing — validated in the service).
  return { ok: true }
}
