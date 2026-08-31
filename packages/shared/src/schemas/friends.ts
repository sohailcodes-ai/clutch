import { z } from 'zod'

export const sendFriendRequestSchema = z.object({
  handle: z.string().min(3).max(24),
})

export const friendUserIdParamSchema = z.object({
  userId: z.string().uuid(),
})

export const listFriendsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
})
