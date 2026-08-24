import { describe, expect, it } from 'vitest'
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  queueJoinSchema,
  matchSubmitSchema,
  submissionSchema,
} from '../src/index.js'

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const parsed = registerSchema.safeParse({
      email: 'player@example.com',
      password: 'supersecret1',
      handle: 'clutch_king',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.region).toBe('global')
  })

  it('rejects malformed emails', () => {
    expect(
      registerSchema.safeParse({ email: 'nope', password: 'supersecret1', handle: 'abc' }).success,
    ).toBe(false)
  })

  it('rejects short passwords', () => {
    expect(
      registerSchema.safeParse({ email: 'a@b.com', password: 'short', handle: 'abc' }).success,
    ).toBe(false)
  })

  it('rejects invalid handles', () => {
    for (const handle of ['ab', 'has space', 'bad-handle!', 'x'.repeat(25)]) {
      expect(
        registerSchema.safeParse({ email: 'a@b.com', password: 'supersecret1', handle }).success,
      ).toBe(false)
    }
  })
})

describe('loginSchema', () => {
  it('accepts valid credentials shape', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })
  it('rejects missing password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false)
  })
})

describe('updateProfileSchema', () => {
  it('rejects oversized bios', () => {
    expect(updateProfileSchema.safeParse({ bio: 'x'.repeat(501) }).success).toBe(false)
  })
  it('rejects non-URL avatars', () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: 'not-a-url' }).success).toBe(false)
  })
})

describe('queueJoinSchema', () => {
  it('requires a stackId', () => {
    expect(queueJoinSchema.safeParse({}).success).toBe(false)
    expect(queueJoinSchema.safeParse({ stackId: 'typescript' }).success).toBe(true)
  })
})

describe('matchSubmitSchema', () => {
  it('rejects empty source code', () => {
    expect(
      matchSubmitSchema.safeParse({ sourceCode: '', idempotencyKey: '12345678' }).success,
    ).toBe(false)
  })

  it('rejects oversized source code', () => {
    expect(
      matchSubmitSchema.safeParse({
        sourceCode: 'x'.repeat(65537),
        idempotencyKey: '12345678',
      }).success,
    ).toBe(false)
  })

  it('rejects short idempotency keys', () => {
    expect(matchSubmitSchema.safeParse({ sourceCode: 'ok', idempotencyKey: 'short' }).success).toBe(
      false,
    )
  })
})

describe('submissionSchema', () => {
  it('validates language enum', () => {
    expect(submissionSchema.safeParse({ sourceCode: 'x', language: 'cobol', idempotencyKey: '12345678' }).success).toBe(false)
    expect(submissionSchema.safeParse({ sourceCode: 'x', language: 'rust', idempotencyKey: '12345678' }).success).toBe(true)
  })
})
