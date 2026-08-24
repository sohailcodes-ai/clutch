import { describe, expect, it } from 'vitest'
import { buildIdempotencyKey } from '../src/idempotency/service.js'
import { AppError, ErrorCodes } from '@clutch/shared'

describe('buildIdempotencyKey', () => {
  it('scopes keys to user and route', () => {
    expect(buildIdempotencyKey('u1', 'queue.join', 'abc12345')).toBe(
      'u1:queue.join:abc12345',
    )
    expect(buildIdempotencyKey('u2', 'queue.join', 'abc12345')).not.toBe(
      buildIdempotencyKey('u1', 'queue.join', 'abc12345'),
    )
    expect(buildIdempotencyKey('u1', 'match.forfeit', 'abc12345')).not.toBe(
      buildIdempotencyKey('u1', 'queue.join', 'abc12345'),
    )
  })
})

describe('AppError codes', () => {
  it('exposes structured competitive-state errors', () => {
    const err = new AppError(ErrorCodes.ALREADY_IN_MATCH, 'Already in an active match', 409)
    expect(err.code).toBe('ALREADY_IN_MATCH')
    expect(err.statusCode).toBe(409)
    expect(err.retryable).toBe(false)
  })
})
