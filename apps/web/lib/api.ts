export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: init.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (body ?? {}) as { error?: string; message?: string }
    throw new ApiError(err.error ?? 'ERROR', err.message ?? 'Request failed', res.status)
  }
  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  delete: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'DELETE', body: data ? JSON.stringify(data) : undefined }),
}

/** True when the server considers first-time onboarding complete. */
export function isOnboarded(user: SessionUser | null): boolean {
  return user?.profile?.onboardingCompletedAt != null
}

// ---------------------------------------------------------------------------
// Shared API response types (mirror the server DTOs)
// ---------------------------------------------------------------------------

export type SessionUser = {
  id: string
  email: string
  status: string
  role: string
  createdAt: string
  profile: {
    handle: string
    displayName: string | null
    avatarUrl: string | null
    equippedTitleId: string | null
    /** Server-authoritative onboarding marker (ISO date or null). */
    onboardingCompletedAt: string | null
    primaryStackId: string | null
  } | null
}

export type EquippedTitle = { code: string; name: string; rarity: string }

export type PlayerCardDto = {
  handle: string
  displayName: string | null
  avatarUrl: string | null
  equippedTitle: EquippedTitle | null
  bestRating: number
  bestStackId: string | null
  tierId: string | null
  globalRank: number | null
  wins: number
  losses: number
  draws: number
  gamesPlayed: number
  peakRating: number
  winRate: number
}

export type RecentMatchDto = {
  matchPublicId: string
  opponentHandle: string | null
  opponentAvatarUrl: string | null
  result: 'win' | 'loss' | 'draw' | 'forfeit' | 'no_result'
  ratingDelta: number | null
  stackId: string
  difficultyId: string
  durationSec: number | null
  resolvedAt: string | null
  ranked: boolean
}

export type StackRatingDto = {
  stackId: string
  rating: number
  tierId: string | null
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  peakRating: number
  placementRemaining: number
}

export type DashboardDto = {
  playerCard: PlayerCardDto
  recentMatches: RecentMatchDto[]
  ratings: StackRatingDto[]
  serverTimeMs: number
}

export type TitleCatalogEntry = {
  code: string
  name: string
  description: string | null
  rarity: string
  kind: string
  icon: string | null
  unlocked: boolean
  awardedAt: string | null
  isSecret: boolean
  progress: { current: number; target: number } | null
}

export type LiveMatchDto = {
  publicId: string
  stackId: string
  stackName: string
  difficultyId: string
  status: string
  ranked: boolean
  timeLimitSec: number
  startedAt: string | null
  endsAt: string | null
  serverTimeMs: number
  players: { handle: string | null; avatarUrl: string | null; slot: number }[]
}

export type RecentResultDto = {
  publicId: string
  stackName: string
  isDraw: boolean
  winnerHandle: string | null
  loserHandle: string | null
  resolvedAt: string | null
}

export type RoomListItemDto = {
  id: string
  publicId: string
  name: string
  stackId: string
  stackName: string
  difficultyId: string | null
  difficultyLabel: string | null
  ranked: boolean
  playerCount: number
  maxPlayers: number
}

export type RoomDetailDto = {
  id: string
  publicId: string
  name: string
  hostHandle: string | null
  stackId: string
  stackName: string
  difficultyId: string | null
  difficultyLabel: string | null
  maxPlayers: number
  isPublic: boolean
  ranked: boolean
  timeLimitSec: number
  questionSelectionMode: string
  status: string
  createdAt: string
  joinCode?: string
  players: {
    handle: string | null
    displayName: string | null
    avatarUrl: string | null
    isHost: boolean
    readyAt: string | null
    joinedAt: string
  }[]
}

export type EventDto = {
  id: string
  slug: string
  name: string
  descriptionMd: string | null
  rulesMd: string | null
  startsAt: string
  endsAt: string
  phase: 'upcoming' | 'active' | 'ended'
  serverTimeMs: number
  maxParticipants: number | null
  registeredCount?: number
  stackIds: string[]
  difficultyIds: string[]
}

export type TournamentDto = {
  id: string
  slug: string
  name: string
  descriptionMd: string | null
  format: string
  status: string
  stackId: string
  stackName: string
  maxParticipants: number
  registeredCount: number
  registrationOpensAt: string
  registrationClosesAt: string
  startsAt: string
  endsAt: string | null
  championHandle: string | null
  serverTimeMs: number
}

export type StackDto = { id: string; name: string; symbol: string }

export type PublicProfileDto = {
  handle: string
  displayName: string | null
  avatarUrl: string | null
  region: string
  bio: string | null
  memberSince: string
  equippedTitle: EquippedTitle | null
  bestRating: number | null
  bestStackId: string | null
  tierId: string | null
  titles: { code: string; name: string; kind: string; rarity: string; awardedAt: string }[]
  ratings: StackRatingDto[]
}

// ---------------------------------------------------------------------------
// Admin console DTOs (server-redacted views)
// ---------------------------------------------------------------------------

/** Mirrors the server-side ADMIN_ROLES list — UI visibility only; every API
 *  independently re-verifies authorization server-side. */
const ADMIN_ROLE_IDS = [
  'super_admin',
  'admin',
  'moderator',
  'question_admin',
  'event_admin',
  'tournament_admin',
  'match_moderator',
]

export function isAdminRoleUi(role: string): boolean {
  return ADMIN_ROLE_IDS.includes(role)
}

export type AdminOverviewDto = {
  serverTimeMs: number
  questions: { published: number; drafts: number; archived: number }
  queue: { stackId: string; waiting: number }[]
  matches: {
    live: number
    recent: {
      publicId: string
      status: string
      stackId: string
      difficultyId: string
      ranked: boolean
      endsAt: string | null
      players: { handle: string | null; avatarUrl: string | null }[]
    }[]
  }
  events: { active: number; upcoming: number }
  moderation: { pendingFlags: number }
}

export type AdminMatchListItemDto = {
  publicId: string
  id?: string
  status: string
  stackName: string
  difficultyId: string
  questionTitle: string
  ranked: boolean
  remainingSec: number | null
  participants: {
    handle: string | null
    avatarUrl: string | null
    submissionState: string
    passedCount: number
    attempts: number
  }[]
}

export type AdminInspectionDto = {
  id: string
  publicId: string
  status: string
  resolutionLabel: 'automatic' | 'admin_adjudication' | 'forfeit' | 'draw'
  stackName: string
  difficultyId: string
  questionTitle: string
  ranked: boolean
  timeLimitSec: number
  startedAt: string | null
  endsAt: string | null
  resolvedAt: string | null
  winnerUserId: string | null
  remainingSec: number | null
  serverTimeMs: number
  participants: {
    userId: string
    handle: string | null
    avatarUrl: string | null
    slot: number
    readyAt: string | null
    ratingBefore: number
    ratingAfter: number | null
    tierId: string | null
    result: string | null
    submissions: {
      id: string
      status: string
      passedCount: number
      totalCount: number
      executionTimeMs: number | null
      isFinal: boolean
      createdAt: string
    }[]
  }[]
  events: { id: number; type: string; actorUserId: string | null; payload: Record<string, unknown>; createdAt: string }[]
}

export type AdminUserListItemDto = {
  userId: string
  handle: string
  avatarUrl: string | null
  role: string
  status: string
  bestRating: number | null
  tierId: string | null
  wins: number
  losses: number
  draws: number
  gamesPlayed: number
}

export type AdminUserDetailDto = {
  userId: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  status: string
  memberSince: string
  email?: string
  equippedTitle: { code: string; name: string } | null
  ratings: StackRatingDto[]
  security?: {
    recentSessions: { ipAddress: string | null; userAgent: string | null; createdAt: string; expiresAt: string }[]
  }
}

export type AdminAuditEntryDto = {
  id: number
  action: string
  actorHandle: string | null
  resourceType: string
  resourceId: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type AdminFlagDto = {
  id: string
  flagType: string
  severity: string
  status: string
  userHandle: string | null
  createdAt: string
}
