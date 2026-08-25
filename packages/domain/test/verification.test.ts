import { describe, expect, it } from 'vitest'
import { generateOtp, hashOtp } from '../src/verification/service.js'
import { getEmailDelivery, resetEmailDelivery } from '../src/verification/email.js'

describe('OTP generation', () => {
  it('generates a 6-digit string', () => {
    const otp = generateOtp()
    expect(otp).toHaveLength(6)
    expect(/^\d{6}$/.test(otp)).toBe(true)
  })

  it('generates different OTPs on successive calls', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 20; i++) {
      seen.add(generateOtp())
    }
    expect(seen.size).toBeGreaterThan(15)
  })
})

describe('OTP hashing', () => {
  it('produces a deterministic SHA-256 hex digest', () => {
    const h1 = hashOtp('123456')
    const h2 = hashOtp('123456')
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(h1)).toBe(true)
  })

  it('different inputs produce different hashes', () => {
    expect(hashOtp('111111')).not.toBe(hashOtp('222222'))
  })
})

describe('email delivery abstraction', () => {
  it('defaults to log mode in development', () => {
    resetEmailDelivery()
    process.env.EMAIL_MODE = 'log'
    const delivery = getEmailDelivery()
    expect(delivery).toBeDefined()
  })

  it('send returns a messageId', async () => {
    resetEmailDelivery()
    process.env.EMAIL_MODE = 'log'
    const delivery = getEmailDelivery()
    const result = await delivery.send({
      to: [{ address: 'test@example.com' }],
      subject: 'Test',
      html: '<p>Hello</p>',
    })
    expect(result.messageId).toBeDefined()
    expect(typeof result.messageId).toBe('string')
  })

  it('singleton returns same instance', () => {
    resetEmailDelivery()
    process.env.EMAIL_MODE = 'log'
    const d1 = getEmailDelivery()
    const d2 = getEmailDelivery()
    expect(d1).toBe(d2)
  })
})
