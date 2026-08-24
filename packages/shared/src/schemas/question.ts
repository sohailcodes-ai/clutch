import { z } from 'zod'

// difficultyId is data-driven (difficulty_bands table); validated against the
// database at the service boundary rather than hardcoded here.
export const createQuestionSchema = z.object({
  slug: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
  title: z.string().min(3).max(200),
  descriptionMd: z.string().max(8000).optional(),
  difficultyId: z.string().min(2).max(24),
  topic: z.string().min(2).max(48),
  tags: z.array(z.string().min(1).max(32)).max(12).default([]),
  timeLimitSec: z.number().int().min(30).max(3600).default(900),
  memoryLimitMb: z.number().int().min(32).max(1024).default(256),
  promptMd: z.string().min(10),
  examples: z
    .array(
      z.object({
        input: z.string().max(2000),
        output: z.string().max(2000),
        explanation: z.string().max(2000).optional(),
      }),
    )
    .max(6)
    .default([]),
  starterCode: z.record(z.string()).default({}),
  stackIds: z.array(z.string()).min(1),
  // Provenance metadata — Clutch originals preferred; external content must
  // carry compatible licensing and attribution.
  source: z.enum(['clutch-original', 'public-domain', 'cc-by', 'licensed']).default('clutch-original'),
  license: z.string().max(120).optional(),
  attribution: z.string().max(240).optional(),
  testCases: z
    .array(
      z.object({
        visibility: z.enum(['public', 'hidden']),
        input: z.string(),
        expectedOutput: z.string(),
        weight: z.number().int().min(1).default(1),
      }),
    )
    .min(1),
})

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>

export const listQuestionsQuerySchema = z.object({
  stackId: z.string().min(1).max(32).optional(),
  topic: z.string().min(2).max(48).optional(),
  difficultyId: z.string().min(2).max(24).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
})

export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>
