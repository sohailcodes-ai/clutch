import { randomBytes, createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { and, eq, gt, or } from 'drizzle-orm'
import type { Database } from '@clutch/db'
import { schema } from '@clutch/db'
import { AppError, ErrorCodes, type RegisterInput, type LoginInput } from '@clutch/shared'
import { DEFAULT_RATING, PLACEMENT_MATCHES } from '@clutch/shared'
import { writeAuditLog } from '../audit.js'

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  )
}

export function generateSessionToken() {
  return randomBytes(32).toString('hex')
}

export async function registerUser(
  db: Database,
  input: RegisterInput,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, input.email.toLowerCase()) })
  if (existing) throw new AppError(ErrorCodes.CONFLICT, 'Email already registered', 409)

  const handleTaken = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.handle, input.handle),
  })
  if (handleTaken) throw new AppError(ErrorCodes.CONFLICT, 'Handle already taken', 409)

  const passwordHash = await bcrypt.hash(input.password, 12)
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  // User, profile, initial ratings and the first session commit atomically so a
  // mid-registration failure can never leave a partial account behind.
  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.users)
      .values({ email: input.email.toLowerCase(), passwordHash })
      .returning()

    if (!created) throw new AppError(ErrorCodes.INTERNAL, 'Failed to create user', 500)

    try {
      await tx.insert(schema.userProfiles).values({
        userId: created.id,
        handle: input.handle,
        displayName: input.handle,
        region: input.region,
      })
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(ErrorCodes.CONFLICT, 'Handle already taken', 409)
      }
      throw err
    }

    const stacks = await tx.query.stacks.findMany({ where: eq(schema.stacks.isActive, true) })
    if (stacks.length > 0) {
      await tx.insert(schema.userStackRatings).values(
        stacks.map((stack) => ({
          userId: created.id,
          stackId: stack.id,
          rating: DEFAULT_RATING,
          // No tier yet: an UNRANKED player must never display a rank.
          tierId: null,
          placementRemaining: PLACEMENT_MATCHES,
          peakRating: DEFAULT_RATING,
        })),
      )
    }

    await tx.insert(schema.authSessions).values({
      userId: created.id,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    })

    await writeAuditLog(tx, {
      actorUserId: created.id,
      action: 'user.register',
      resourceType: 'user',
      resourceId: created.id,
      ipAddress: meta?.ipAddress,
    })

    return created
  }).catch((err) => {
    // A concurrent registration could win the email unique index race.
    if (isUniqueViolation(err)) {
      throw new AppError(ErrorCodes.CONFLICT, 'Email already registered', 409)
    }
    throw err
  })

  return { user, token, expiresAt }
}

export async function loginUser(
  db: Database,
  input: LoginInput,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const identifier = input.email.trim()
  let user = await db.query.users.findFirst({
    where: eq(schema.users.email, identifier.toLowerCase()),
  })
  // Handle-based login: resolve the public handle to its account. Additive
  // lookup — hashing, sessions and error responses are unchanged, and the
  // identical 'Invalid credentials' response prevents handle enumeration.
  if (!user && !identifier.includes('@')) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.handle, identifier),
    })
    if (profile) {
      user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) })
    }
  }
  if (!user) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid credentials', 401)

  const valid = await bcrypt.compare(input.password, user.passwordHash)
  if (!valid) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid credentials', 401)
  if (user.status !== 'active') throw new AppError(ErrorCodes.FORBIDDEN, 'Account is not active', 403)

  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(schema.authSessions).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  await writeAuditLog(db, {
    actorUserId: user.id,
    action: 'user.login',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress: meta?.ipAddress,
  })

  return { user, token, expiresAt }
}

export async function logoutUser(db: Database, token: string) {
  await db.delete(schema.authSessions).where(eq(schema.authSessions.tokenHash, hashToken(token)))
}

export async function getSessionUser(db: Database, token: string) {
  const session = await db.query.authSessions.findFirst({
    where: and(
      eq(schema.authSessions.tokenHash, hashToken(token)),
      gt(schema.authSessions.expiresAt, new Date()),
    ),
    with: {
      user: {
        with: { profile: true },
      },
    },
  })

  if (!session?.user || session.user.status !== 'active') return null
  return session.user
}

export async function getUserByHandle(db: Database, handle: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.handle, handle),
    with: { user: true },
  })
  if (!profile || profile.user.status !== 'active') return null
  return profile
}
