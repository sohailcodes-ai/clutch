/**
 * ============================================================================
 * EMAIL VERIFICATION SERVICE
 * ============================================================================
 * Handles OTP generation, hashing, persistence, and verification.
 *
 * SECURITY:
 * - OTPs are generated using cryptographically secure random (crypto.randomInt)
 * - Only OTP hashes are stored — plaintext OTPs are never persisted
 * - OTPs are single-use and invalidated after consumption
 * - Rate limiting protects against brute-force and resend abuse
 * - Verification tokens are invalidated when a new OTP is generated
 *
 * Flow:
 *   requestVerification → send email → verifyOtp → mark verified
 * ============================================================================
 */

import { randomInt, createHash } from 'node:crypto'
import { and, eq, gt, desc, isNull } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import type { Database } from '@clutch/db'
import { schema } from '@clutch/db'
import { AppError, ErrorCodes } from '@clutch/shared'
import { checkRateLimit } from '../security/rate-limit.js'
import { getEmailDelivery } from './email.js'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OTP_LENGTH = 6
const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = 5
const RESEND_COOLDOWN_MS = 60 * 1000 // 1 minute

// Rate limit keys
const VERIFY_REQUEST_LIMIT = { key: 'verify:request', limit: 5, windowSec: 3600 }
const OTP_ATTEMPT_LIMIT = { key: 'verify:attempt', limit: 10, windowSec: 900 }
const RESEND_LIMIT = { key: 'verify:resend', limit: 3, windowSec: 300 }

// ---------------------------------------------------------------------------
// OTP Generation & Hashing
// ---------------------------------------------------------------------------

/** Generate a cryptographically secure 6-digit OTP. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, '0')
}

/** Hash an OTP using SHA-256. Storage-safe, never reversible. */
export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

// ---------------------------------------------------------------------------
// Request Verification
// ---------------------------------------------------------------------------

export async function requestVerification(
  db: Database,
  redis: Redis,
  userId: string,
): Promise<{ sent: boolean }> {
  // Rate limit: verification requests per IP/user
  const rl = await checkRateLimit(
    redis,
    `${VERIFY_REQUEST_LIMIT.key}:${userId}`,
    VERIFY_REQUEST_LIMIT.limit,
    VERIFY_REQUEST_LIMIT.windowSec,
    { failClosed: true },
  )
  if (!rl.allowed) {
    throw new AppError(ErrorCodes.TOO_MANY_REQUESTS, 'Too many verification requests. Try again later.', 429)
  }

  // Rate limit: resend cooldown
  const resendRl = await checkRateLimit(
    redis,
    `${RESEND_LIMIT.key}:${userId}`,
    RESEND_LIMIT.limit,
    RESEND_LIMIT.windowSec,
    { failClosed: true },
  )
  if (!resendRl.allowed) {
    throw new AppError(ErrorCodes.TOO_MANY_REQUESTS, 'Please wait before requesting another code.', 429)
  }

  // Fetch user for email address
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) })
  if (!user) throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404)

  // Already verified?
  if (user.emailVerifiedAt) return { sent: true }

  // Invalidate any previous unconsumed tokens for this user
  await db
    .update(schema.verificationTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(schema.verificationTokens.userId, userId),
        isNull(schema.verificationTokens.consumedAt),
      ),
    )

  // Generate and store OTP
  const otp = generateOtp()
  const otpHash = hashOtp(otp)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS)

  await db.insert(schema.verificationTokens).values({
    userId,
    otpHash,
    expiresAt,
    maxAttempts: MAX_ATTEMPTS,
  })

  // Send email
  const delivery = getEmailDelivery()
  await delivery.send({
    to: [{ address: user.email }],
    subject: 'Verify your Clutch account',
    html: buildVerificationEmailHtml(otp),
    text: buildVerificationEmailText(otp),
  })

  return { sent: true }
}

// ---------------------------------------------------------------------------
// Verify OTP
// ---------------------------------------------------------------------------

export async function verifyOtp(
  db: Database,
  redis: Redis,
  userId: string,
  otp: string,
): Promise<{ verified: boolean }> {
  // Rate limit: OTP attempts
  const rl = await checkRateLimit(
    redis,
    `${OTP_ATTEMPT_LIMIT.key}:${userId}`,
    OTP_ATTEMPT_LIMIT.limit,
    OTP_ATTEMPT_LIMIT.windowSec,
    { failClosed: true },
  )
  if (!rl.allowed) {
    throw new AppError(ErrorCodes.TOO_MANY_REQUESTS, 'Too many verification attempts. Try again later.', 429)
  }

  // Fetch user
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) })
  if (!user) throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404)

  // Already verified?
  if (user.emailVerifiedAt) return { verified: true }

  // Find the latest unconsumed token
  const token = await db.query.verificationTokens.findFirst({
    where: and(
      eq(schema.verificationTokens.userId, userId),
      isNull(schema.verificationTokens.consumedAt),
      gt(schema.verificationTokens.expiresAt, new Date()),
    ),
    orderBy: desc(schema.verificationTokens.createdAt),
  })

  if (!token) {
    throw new AppError(ErrorCodes.VALIDATION, 'No valid verification code found. Please request a new one.', 400)
  }

  // Check attempt count
  if (token.attemptCount >= token.maxAttempts) {
    throw new AppError(ErrorCodes.VALIDATION, 'Verification code has expired. Please request a new one.', 400)
  }

  // Verify OTP
  const otpHash = hashOtp(otp)
  if (otpHash !== token.otpHash) {
    // Increment attempt count
    await db
      .update(schema.verificationTokens)
      .set({ attemptCount: token.attemptCount + 1 })
      .where(eq(schema.verificationTokens.id, token.id))

    throw new AppError(ErrorCodes.VALIDATION, 'Invalid verification code.', 400)
  }

  // Mark token as consumed and user as verified
  await db.transaction(async (tx) => {
    await tx
      .update(schema.verificationTokens)
      .set({ consumedAt: new Date() })
      .where(eq(schema.verificationTokens.id, token.id))

    await tx
      .update(schema.users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(schema.users.id, userId))
  })

  return { verified: true }
}

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

function buildVerificationEmailHtml(otp: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:monospace;">
  <div style="max-width:480px;margin:40px auto;padding:32px;background-color:#111;border:1px solid #222;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:24px;font-weight:900;color:#fff;letter-spacing:4px;">CLUTCH</span>
    </div>
    <h1 style="color:#fff;font-size:18px;font-weight:700;text-align:center;margin-bottom:24px;">
      Verify your account
    </h1>
    <p style="color:#888;font-size:13px;line-height:1.6;text-align:center;margin-bottom:24px;">
      You're creating a Clutch account.<br>
      Use the verification code below to confirm that you control this email address.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <span style="font-size:32px;font-weight:900;color:#fff;letter-spacing:8px;background:#1a1a1a;padding:16px 32px;border:1px solid #333;display:inline-block;">
        ${otp}
      </span>
    </div>
    <p style="color:#666;font-size:11px;text-align:center;line-height:1.5;">
      This code expires in 10 minutes and can only be used once.<br>
      If you didn't create a Clutch account, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`
}

function buildVerificationEmailText(otp: string): string {
  return `CLUTCH — Verify your account

You're creating a Clutch account.
Use the verification code below to confirm that you control this email address.

${otp}

This code expires in 10 minutes and can only be used once.

If you didn't create a Clutch account, you can safely ignore this email.`
}
