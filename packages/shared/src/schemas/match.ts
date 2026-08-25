import { z } from 'zod'

export const matchReadySchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
})

export const matchSubmitSchema = z.object({
  sourceCode: z.string().min(1).max(65536),
  idempotencyKey: z.string().min(8).max(128),
  isFinal: z.boolean().default(true),
})

export const matchRunSchema = z.object({
  sourceCode: z.string().min(1).max(65536),
  stdin: z.string().max(65536).default(''),
  stackId: z.string().min(1).max(32),
})

export type MatchReadyInput = z.infer<typeof matchReadySchema>
export type MatchSubmitInput = z.infer<typeof matchSubmitSchema>
export type MatchRunInput = z.infer<typeof matchRunSchema>
