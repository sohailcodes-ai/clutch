import { and, asc, desc, eq, gt, ne, sql } from 'drizzle-orm'
import type { DbExecutor } from '@clutch/db'
import { schema } from '@clutch/db'
import { AppError, ErrorCodes, type TitleRarity } from '@clutch/shared'
import { writeAuditLog } from '../audit.js'

/**
 * Data-driven title/badge system.
 *
 * Titles are defined as ROWS in the `titles` table with a JSON criteria
 * document. Criteria types supported by the evaluator below form a small,
 * closed, server-authoritative vocabulary. The client can display awards but
 * can NEVER create, trigger or unlock them — every unlock flows through
 * `evaluateAndAwardTitles`, which derives facts exclusively from PostgreSQL.
 *
 * Supported criteria shapes:
 *   { "type": "wins",              "value": 10 }
 *   { "type": "matches",           "value": 25 }
 *   { "type": "draws",             "value": 5 }
 *   { "type": "rating",            "value": 2400, "stackId": "optional" }
 *   { "type": "win_streak",        "value": 5 }
 *   { "type": "unique_solved",     "value": 50 }
 *   { "type": "stacks_won",        "value": 3 }
 *   { "type": "difficulty_climb",  "value": 3 }
 *   { "type": "top_rank",          "value": 100 }
 *   { "type": "fast_win",          "value": 60000 }   // ms
 *   { "type": "comeback" }                             // won from behind
 *   { "type": "first_blood_fast",  "value": 60000 }   // ms
 *   { "type": "first_blood" }
 *   { "type": "first_blood_count", "value": 5 }       // count of first bloods
 *   { "type": "comeback_count",    "value": 5 }       // count of comeback wins
 *   { "type": "underdog_wins",     "value": 5 }       // vs 200+ higher rated
 *   { "type": "clean_sweeps",      "value": 10 }      // all tests passed on final
 *   { "type": "perfect_execution", "value": 20 }      // accepted first try across matches
 *   { "type": "high_volume_wins",  "value": 100 }
 *   { "type": "comeback_streak",   "value": 3 }       // consecutive comeback wins
 *   { "type": "no_submit_wins",    "value": 5 }       // opponent never submitted
 */

export type TitleCriteria =
  | { type: 'wins'; value: number }
  | { type: 'matches'; value: number }
  | { type: 'draws'; value: number }
  | { type: 'rating'; value: number; stackId?: string }
  | { type: 'win_streak'; value: number }
  | { type: 'unique_solved'; value: number }
  | { type: 'stacks_won'; value: number }
  | { type: 'difficulty_climb'; value: number }
  | { type: 'top_rank'; value: number }
  | { type: 'fast_win'; value: number }
  | { type: 'first_blood' }
  | { type: 'comeback' }
  | { type: 'first_blood_fast'; value: number }
  | { type: 'first_blood_count'; value: number }
  | { type: 'comeback_count'; value: number }
  | { type: 'underdog_wins'; value: number }
  | { type: 'clean_sweeps'; value: number }
  | { type: 'perfect_execution'; value: number }
  | { type: 'high_volume_wins'; value: number }
  | { type: 'comeback_streak'; value: number }
  | { type: 'no_submit_wins'; value: number }

export function isTitleCriteria(value: unknown): value is TitleCriteria {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Record<string, unknown>
  switch (c.type) {
    case 'wins':
    case 'matches':
    case 'draws':
    case 'rating':
    case 'win_streak':
    case 'unique_solved':
    case 'stacks_won':
    case 'difficulty_climb':
    case 'top_rank':
    case 'fast_win':
    case 'first_blood_fast':
    case 'first_blood_count':
    case 'comeback_count':
    case 'underdog_wins':
    case 'clean_sweeps':
    case 'perfect_execution':
    case 'high_volume_wins':
    case 'comeback_streak':
    case 'no_submit_wins':
      return typeof c.value === 'number' && c.value >= 0
    case 'first_blood':
    case 'comeback':
      return true
    default:
      return false
  }
}

/** Aggregated competitive facts about a user — all derived from PostgreSQL. */
export type CompetitiveFacts = {
  wins: number
  losses: number
  draws: number
  matches: number
  peakRating: number
  peakRatingByStack: Record<string, number>
  firstBloods: number
  /** Current consecutive-win run across ranked matches (most recent first). */
  currentWinStreak: number
  /** Best consecutive-win run ever. */
  bestWinStreak: number
  /** Distinct questions with at least one accepted outcome. */
  uniqueSolved: number
  /** Distinct stacks with at least one win. */
  stacksWon: number
  /** Distinct difficulty bands the user has solved something in. */
  difficultiesSolved: number
  /** Best global rank ever observed at evaluation time (null = unranked). */
  globalRank: number | null
  /** Fastest fully-accepted winning submission, in ms (null = none). */
  fastestWinMs: number | null
  /** Wins after having failed an earlier submission in the same match. */
  comebackWins: number
  /** Wins against opponents rated 200+ points higher. */
  underdogWins: number
  /** Matches where every test passed on the final submission (clean win). */
  cleanSweeps: number
  /** Matches where first submission was accepted (perfect first try). */
  perfectExecutions: number
  /** Consecutive comeback wins (most recent). */
  currentComebackStreak: number
  /** Best comeback streak ever. */
  bestComebackStreak: number
  /** Wins where opponent never submitted. */
  noSubmitWins: number
}

export const EMPTY_FACTS: CompetitiveFacts = {
  wins: 0,
  losses: 0,
  draws: 0,
  matches: 0,
  peakRating: 0,
  peakRatingByStack: {},
  firstBloods: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  uniqueSolved: 0,
  stacksWon: 0,
  difficultiesSolved: 0,
  globalRank: null,
  fastestWinMs: null,
  comebackWins: 0,
  underdogWins: 0,
  cleanSweeps: 0,
  perfectExecutions: 0,
  currentComebackStreak: 0,
  bestComebackStreak: 0,
  noSubmitWins: 0,
}

/** Pure criteria evaluation — unit-testable, deterministic. */
export function evaluateCriteria(criteria: TitleCriteria, facts: CompetitiveFacts): boolean {
  switch (criteria.type) {
    case 'wins':
      return facts.wins >= criteria.value
    case 'matches':
      return facts.matches >= criteria.value
    case 'draws':
      return facts.draws >= criteria.value
    case 'rating': {
      const peak = criteria.stackId
        ? (facts.peakRatingByStack[criteria.stackId] ?? 0)
        : facts.peakRating
      return peak >= criteria.value
    }
    case 'win_streak':
      return facts.bestWinStreak >= criteria.value
    case 'unique_solved':
      return facts.uniqueSolved >= criteria.value
    case 'stacks_won':
      return facts.stacksWon >= criteria.value
    case 'difficulty_climb':
      return facts.difficultiesSolved >= criteria.value
    case 'top_rank':
      return facts.globalRank !== null && facts.globalRank <= criteria.value
    case 'fast_win':
      return facts.fastestWinMs !== null && facts.fastestWinMs <= criteria.value
    case 'first_blood':
      return facts.firstBloods >= 1
    case 'comeback':
      return facts.comebackWins >= 1
    case 'first_blood_fast':
      return (
        facts.firstBloods >= 1 &&
        facts.fastestWinMs !== null &&
        facts.fastestWinMs <= criteria.value
      )
    case 'first_blood_count':
      return facts.firstBloods >= criteria.value
    case 'comeback_count':
      return facts.comebackWins >= criteria.value
    case 'underdog_wins':
      return facts.underdogWins >= criteria.value
    case 'clean_sweeps':
      return facts.cleanSweeps >= criteria.value
    case 'perfect_execution':
      return facts.perfectExecutions >= criteria.value
    case 'high_volume_wins':
      return facts.wins >= criteria.value
    case 'comeback_streak':
      return facts.bestComebackStreak >= criteria.value
    case 'no_submit_wins':
      return facts.noSubmitWins >= criteria.value
  }
}

/**
 * Deterministic progress toward a criteria threshold. Returns null for
 * boolean criteria that cannot express partial progress.
 */
export function titleProgress(
  criteria: TitleCriteria,
  facts: CompetitiveFacts,
): { current: number; target: number } | null {
  const pick = (current: number, target: number) =>
    target > 0 ? { current: Math.min(current, target), target } : null
  switch (criteria.type) {
    case 'wins':
      return pick(facts.wins, criteria.value)
    case 'matches':
      return pick(facts.matches, criteria.value)
    case 'draws':
      return pick(facts.draws, criteria.value)
    case 'rating': {
      const peak = criteria.stackId
        ? (facts.peakRatingByStack[criteria.stackId] ?? 0)
        : facts.peakRating
      return pick(peak, criteria.value)
    }
    case 'win_streak':
      return pick(facts.bestWinStreak, criteria.value)
    case 'unique_solved':
      return pick(facts.uniqueSolved, criteria.value)
    case 'stacks_won':
      return pick(facts.stacksWon, criteria.value)
    case 'difficulty_climb':
      return pick(facts.difficultiesSolved, criteria.value)
    case 'top_rank':
      return facts.globalRank !== null ? pick(facts.globalRank, criteria.value) : null
    case 'fast_win':
      return facts.fastestWinMs !== null ? pick(facts.fastestWinMs, criteria.value) : null
    case 'underdog_wins':
      return pick(facts.underdogWins, criteria.value)
    case 'first_blood_count':
      return pick(facts.firstBloods, criteria.value)
    case 'comeback_count':
      return pick(facts.comebackWins, criteria.value)
    case 'clean_sweeps':
      return pick(facts.cleanSweeps, criteria.value)
    case 'perfect_execution':
      return pick(facts.perfectExecutions, criteria.value)
    case 'high_volume_wins':
      return pick(facts.wins, criteria.value)
    case 'comeback_streak':
      return pick(facts.bestComebackStreak, criteria.value)
    case 'no_submit_wins':
      return pick(facts.noSubmitWins, criteria.value)
    default:
      return null
  }
}

async function getGlobalRank(db: DbExecutor, userId: string): Promise<number | null> {
  // Global rank: position of the player's BEST stack rating among every
  // player's best stack rating. Computed entirely server-side.
  const ratings = await db.query.userStackRatings.findMany({
    where: eq(schema.userStackRatings.userId, userId),
    columns: { rating: true },
  })
  if (ratings.length === 0) return null
  const myBest = Math.max(...ratings.map((r) => r.rating))

  const betterRows = await db
    .select({ uid: schema.userStackRatings.userId })
    .from(schema.userStackRatings)
    .groupBy(schema.userStackRatings.userId)
    .having(gt(maxRatingExpr, myBest))
  return betterRows.length + 1
}

const maxRatingExpr = sql<number>`MAX(${schema.userStackRatings.rating})`

export async function getCompetitiveFacts(
  db: DbExecutor,
  userId: string,
): Promise<CompetitiveFacts> {
  const ratings = await db.query.userStackRatings.findMany({
    where: eq(schema.userStackRatings.userId, userId),
  })

  const participants = await db.query.matchParticipants.findMany({
    where: eq(schema.matchParticipants.userId, userId),
    with: { match: true },
  })

  // Collect all match IDs for batch queries
  const matchIds = [...new Set(participants.map((p) => p.matchId))]

  // Batch fetch all submissions for these matches
  const allSubmissions = matchIds.length > 0
    ? await db.query.submissions.findMany({
        where: sql`${schema.submissions.matchId} = ANY(${matchIds})`,
      })
    : []

  // Batch fetch all test cases for these question versions
  const questionVersionIds = [...new Set(participants.map((p) => p.match.questionVersionId))]
  const allTestCases = questionVersionIds.length > 0
    ? await db.query.testCases.findMany({
        where: sql`${schema.testCases.questionVersionId} = ANY(${questionVersionIds})`,
      })
    : []

  // Batch fetch all opponents for these matches
  const allParticipants = matchIds.length > 0
    ? await db.query.matchParticipants.findMany({
        where: sql`${schema.matchParticipants.matchId} = ANY(${matchIds})`,
      })
    : []

  // Group data in memory for O(1) lookups
  const submissionsByMatchUser = new Map<string, typeof allSubmissions>()
  for (const sub of allSubmissions) {
    const key = `${sub.matchId}:${sub.userId}`
    const existing = submissionsByMatchUser.get(key) ?? []
    existing.push(sub)
    submissionsByMatchUser.set(key, existing)
  }

  const testCasesByVersion = new Map<string, typeof allTestCases>()
  for (const tc of allTestCases) {
    const existing = testCasesByVersion.get(tc.questionVersionId) ?? []
    existing.push(tc)
    testCasesByVersion.set(tc.questionVersionId, existing)
  }

  const participantsByMatch = new Map<string, typeof allParticipants>()
  for (const p of allParticipants) {
    const existing = participantsByMatch.get(p.matchId) ?? []
    existing.push(p)
    participantsByMatch.set(p.matchId, existing)
  }

  let wins = 0
  let losses = 0
  let draws = 0
  let matchesPlayed = 0
  let firstBloods = 0
  let comebackWins = 0
  let fastestWinMs: number | null = null
  let underdogWins = 0
  let cleanSweeps = 0
  let perfectExecutions = 0
  let noSubmitWins = 0
  let currentComebackStreak = 0
  let bestComebackStreak = 0

  // Chronological walk over finished RATED matches for streak computation.
  // Unranked room matches never contribute to competitive achievements.
  const finished = participants
    .filter((p) => p.match.ranked && ['resolved', 'draw', 'abandoned'].includes(p.match.status))
    .sort(
      (a, b) =>
        (a.match.resolvedAt ?? a.match.createdAt).getTime() -
        (b.match.resolvedAt ?? b.match.createdAt).getTime(),
    )

  let runningStreak = 0
  let bestStreak = 0

  for (const p of finished) {
    const m = p.match
    matchesPlayed += 1

    if (m.winnerUserId === userId) {
      wins += 1
      runningStreak += 1
      bestStreak = Math.max(bestStreak, runningStreak)

      const mySubs = submissionsByMatchUser.get(`${m.id}:${userId}`) ?? []
      const myBest = mySubs
        .sort((a, b) => (b.passedCount ?? 0) - (a.passedCount ?? 0))[0]

      if (myBest && myBest.isFinal && myBest.status === 'accepted') {
        if (myBest.executionTimeMs !== null) {
          fastestWinMs =
            fastestWinMs === null
              ? myBest.executionTimeMs
              : Math.min(fastestWinMs, myBest.executionTimeMs)
        }

        // Clean sweep: every test passed on the final submission
        const tests = testCasesByVersion.get(m.questionVersionId) ?? []
        const totalWeight = tests.reduce((sum, t) => sum + t.weight, 0)
        if (myBest.passedCount >= totalWeight) cleanSweeps += 1

        // Perfect execution: first submission in the match was accepted
        const earlierSubmission = mySubs.find((s) => s.id !== myBest.id)
        if (!earlierSubmission) perfectExecutions += 1

        // Comeback: the winner had an earlier non-accepted attempt in the
        // match before landing the accepted one.
        const earlierFailed = mySubs.find(
          (s) => s.id !== myBest.id && s.status !== 'accepted',
        )
        if (earlierFailed) {
          comebackWins += 1
          currentComebackStreak += 1
          bestComebackStreak = Math.max(bestComebackStreak, currentComebackStreak)
        } else {
          currentComebackStreak = 0
        }

        // Underdog win: opponent was rated 200+ higher
        const matchParticipants = participantsByMatch.get(m.id) ?? []
        const opponentParticipant = matchParticipants.find((op) => op.userId !== userId)
        if (opponentParticipant && p.ratingBefore !== null) {
          const ratingDiff = p.ratingBefore - (opponentParticipant.ratingBefore ?? 0)
          if (ratingDiff <= -200) underdogWins += 1
        }
      } else {
        currentComebackStreak = 0
      }

      if (m.resolveReason === 'judged') {
        // First Blood: won a judged match where the opponent never got a
        // single accepted test run.
        const matchParticipants = participantsByMatch.get(m.id) ?? []
        const opponent = matchParticipants.find((op) => op.userId !== userId)
        let opponentScored = false
        let opponentSubmitted = false
        if (opponent) {
          const opponentSubs = submissionsByMatchUser.get(`${m.id}:${opponent.userId}`) ?? []
          opponentSubmitted = opponentSubs.length > 0
          const best = opponentSubs.sort((a, b) => (b.passedCount ?? 0) - (a.passedCount ?? 0))[0]
          opponentScored = (best?.passedCount ?? 0) > 0
        }
        if (!opponentScored) firstBloods += 1
        if (!opponentSubmitted) noSubmitWins += 1
      }
    } else if (m.winnerUserId && m.winnerUserId !== userId) {
      losses += 1
      runningStreak = 0
      currentComebackStreak = 0
    } else {
      draws += 1
      currentComebackStreak = 0
    }
  }

  const [stats] = await db
    .select({
      uniqueSolved: sql<number>`COUNT(DISTINCT ${schema.userQuestionStats.questionId})`,
      difficultiesSolved: sql<number>`COUNT(DISTINCT ${schema.userQuestionStats.difficultyId})`,
    })
    .from(schema.userQuestionStats)
    .where(and(eq(schema.userQuestionStats.userId, userId), gt(schema.userQuestionStats.solved, 0)))

  const peakRating = ratings.reduce((max, r) => Math.max(max, r.peakRating), 0)
  const peakRatingByStack: Record<string, number> = {}
  for (const r of ratings) {
    peakRatingByStack[r.stackId] = Math.max(peakRatingByStack[r.stackId] ?? 0, r.peakRating)
  }
  const stacksWon = ratings.filter((r) => r.wins > 0).length
  const globalRank = await getGlobalRank(db, userId)

  return {
    wins,
    losses,
    draws,
    matches: matchesPlayed,
    peakRating,
    peakRatingByStack,
    firstBloods,
    currentWinStreak: runningStreak,
    bestWinStreak: bestStreak,
    uniqueSolved: Number(stats?.uniqueSolved ?? 0),
    stacksWon,
    difficultiesSolved: Number(stats?.difficultiesSolved ?? 0),
    globalRank,
    fastestWinMs,
    comebackWins,
    underdogWins,
    cleanSweeps,
    perfectExecutions,
    currentComebackStreak,
    bestComebackStreak,
    noSubmitWins,
  }
}

/**
 * Evaluates every active title against the user's facts and inserts any newly
 * earned ones. Idempotent via unique(user_id, title_id). Runs inside an
 * optional caller transaction.
 */
export async function evaluateAndAwardTitles(db: DbExecutor, userId: string, matchId?: string) {
  const activeTitles = await db.query.titles.findMany({
    where: eq(schema.titles.isActive, true),
  })
  if (activeTitles.length === 0) return []

  const existing = await db.query.userTitles.findMany({
    where: eq(schema.userTitles.userId, userId),
  })
  const ownedIds = new Set(existing.map((t) => t.titleId))

  const facts = await getCompetitiveFacts(db, userId)
  const awarded: { code: string; name: string }[] = []

  for (const title of activeTitles) {
    if (ownedIds.has(title.id)) continue
    const criteria = title.criteria as unknown
    if (!isTitleCriteria(criteria)) continue
    if (!evaluateCriteria(criteria, facts)) continue

    await db
      .insert(schema.userTitles)
      .values({ userId, titleId: title.id, matchId: matchId ?? null })
      .onConflictDoNothing()

    await writeAuditLog(db, {
      actorUserId: userId,
      action: 'title.awarded',
      resourceType: 'title',
      resourceId: title.code,
      metadata: { matchId: matchId ?? null },
    })

    awarded.push({ code: title.code, name: title.name })
  }

  return awarded
}

export async function getUserAwards(db: DbExecutor, userId: string) {
  return db.query.userTitles.findMany({
    where: eq(schema.userTitles.userId, userId),
    with: { title: true },
    orderBy: (t, { asc }) => asc(t.titleId),
  })
}

export async function listActiveTitles(db: DbExecutor) {
  return db.query.titles.findMany({
    where: and(eq(schema.titles.isActive, true)),
    orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.code)],
  })
}

/** The shape returned to clients — locked secrets never expose criteria. */
export type CatalogEntry = {
  code: string
  name: string
  description: string | null
  rarity: TitleRarity
  kind: string
  icon: string | null
  unlocked: boolean
  awardedAt: string | null
  isSecret: boolean
  progress: { current: number; target: number } | null
}

/**
 * Full discovery view: every active title, unlocked state and progress toward
 * unlock. Secret titles that are still locked collapse to
 * "???" / "Secret Achievement" and hide their condition.
 */
export async function getTitleCatalogForUser(
  db: DbExecutor,
  userId: string,
): Promise<CatalogEntry[]> {
  const [titles, awards, facts] = await Promise.all([
    listActiveTitles(db),
    getUserAwards(db, userId),
    getCompetitiveFacts(db, userId),
  ])
  const ownedByCode = new Map(awards.map((a) => [a.title.code, a]))

  return titles.map((t) => {
    const owned = ownedByCode.get(t.code)
    const criteria = t.criteria as unknown
    const valid = isTitleCriteria(criteria)

    if (owned) {
      return {
        code: t.code,
        name: t.name,
        description: t.description,
        rarity: t.rarity,
        kind: t.kind,
        icon: t.icon,
        unlocked: true,
        awardedAt: owned.awardedAt.toISOString(),
        isSecret: t.isSecret,
        progress: null,
      }
    }

    if (t.isSecret || !valid) {
      return {
        code: t.isSecret ? t.code : t.code,
        name: t.isSecret ? 'Secret Achievement' : t.name,
        description: t.isSecret ? '???' : t.description,
        rarity: t.rarity,
        kind: t.kind,
        icon: null,
        unlocked: false,
        awardedAt: null,
        isSecret: t.isSecret,
        progress: null,
      }
    }

    return {
      code: t.code,
      name: t.name,
      description: t.description,
      rarity: t.rarity,
      kind: t.kind,
      icon: t.icon,
      unlocked: false,
      awardedAt: null,
      isSecret: false,
      progress: titleProgress(criteria, facts),
    }
  })
}

/** Equip ONE owned title (or unequip with null). Server-side ownership check. */
export async function equipTitle(
  db: DbExecutor,
  userId: string,
  titleCode: string | null,
): Promise<{ equipped: CatalogEntry | null }> {
  if (titleCode === null) {
    await db
      .update(schema.userProfiles)
      .set({ equippedTitleId: null, updatedAt: new Date() })
      .where(eq(schema.userProfiles.userId, userId))
    return { equipped: null }
  }

  const title = await db.query.titles.findFirst({ where: eq(schema.titles.code, titleCode) })
  if (!title || !title.isActive) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Title not found', 404)
  }

  const award = await db.query.userTitles.findFirst({
    where: and(eq(schema.userTitles.userId, userId), eq(schema.userTitles.titleId, title.id)),
  })
  if (!award) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'You have not unlocked this title', 403)
  }

  await db
    .update(schema.userProfiles)
    .set({ equippedTitleId: title.id, updatedAt: new Date() })
    .where(eq(schema.userProfiles.userId, userId))

  return {
    equipped: {
      code: title.code,
      name: title.name,
      description: title.description,
      rarity: title.rarity,
      kind: title.kind,
      icon: title.icon,
      unlocked: true,
      awardedAt: award.awardedAt.toISOString(),
      isSecret: title.isSecret,
      progress: null,
    },
  }
}
