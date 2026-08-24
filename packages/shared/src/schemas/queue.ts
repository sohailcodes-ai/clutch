import { z } from 'zod'

export const queueJoinSchema = z.object({
  stackId: z.string().min(1),
  difficultyId: z.string().optional(),
})

export type QueueJoinInput = z.infer<typeof queueJoinSchema>
