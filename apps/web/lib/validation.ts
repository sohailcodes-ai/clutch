import { registerSchema } from '@clutch/shared'

/**
 * Client-side handle validation DERIVED from the shared backend schema, so
 * client and server constraints can never drift. The server always
 * re-validates; messages here are presentation only.
 */
export const handleSchema = registerSchema.shape.handle

export function describeHandleRules(): string {
  return '3–24 characters; letters, numbers and underscore only'
}
