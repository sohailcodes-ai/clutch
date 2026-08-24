import {
  PLACEMENT_MATCHES,
  PLACEMENT_QUEUE_BAND_INITIAL,
  QUEUE_BAND_INITIAL,
  type CompetitiveStatus,
} from '@clutch/shared'

/**
 * ============================================================================
 * PLACEMENT SYSTEM — single source of truth for competitive-state derivation.
 * ============================================================================
 * All state lives in the existing `user_stack_ratings.placement_remaining`
 * column (server-authoritative). Nothing here mutates data; these are pure
 * functions used by matchmaking, rating, DTO serialization and the tests so
 * the unranked → placed progression has exactly one definition.
 */

/** A player is UNRANKED while any placement matches remain, else RANKED. */
export function competitiveStatusOf(placementRemaining: number): CompetitiveStatus {
  return placementRemaining > 0 ? 'unranked' : 'ranked'
}

/** Placement progress derived from remaining count — never from gamesPlayed,
 *  which survives season resets and would double-count. */
export function placementMatchesCompleted(placementRemaining: number): number {
  const remaining = normalizeRemaining(placementRemaining)
  return Math.min(PLACEMENT_MATCHES, Math.max(0, PLACEMENT_MATCHES - remaining))
}

function normalizeRemaining(placementRemaining: number): number {
  return Math.max(0, Math.min(PLACEMENT_MATCHES, placementRemaining))
}

/** The public competitive-identity fragment shared by every player-facing DTO.
 *  Built ONLY from authoritative rating rows; no client input participates. */
export function buildCompetitiveIdentity(row: { placementRemaining: number }): {
  competitiveStatus: CompetitiveStatus
  placementMatchesRequired: number
  placementMatchesCompleted: number
  placementRemaining: number
} {
  const remaining = normalizeRemaining(row.placementRemaining)
  return {
    competitiveStatus: competitiveStatusOf(remaining),
    placementMatchesRequired: PLACEMENT_MATCHES,
    placementMatchesCompleted: placementMatchesCompleted(remaining),
    placementRemaining: remaining,
  }
}

// ---------------------------------------------------------------------------
// Matchmaking policy for uncertain skill
// ---------------------------------------------------------------------------

/**
 * Initial pairing half-band for a pair where at least one side is in
 * placement: wider than ranked (skill uncertainty) but strictly bounded by
 * the shared expansion ceiling — a new player is NEVER matched randomly
 * against the whole population.
 */
export function pairingInitialBand(involvesPlacementPlayer: boolean): number {
  return involvesPlacementPlayer ? PLACEMENT_QUEUE_BAND_INITIAL : QUEUE_BAND_INITIAL
}

// ---------------------------------------------------------------------------
// Question difficulty during placement
// ---------------------------------------------------------------------------

/**
 * Deterministic difficulty bias (in difficulty-band steps toward easier
 * content) derived ONLY from how many placement matches remain. Early
 * placements start accessible; later ones converge to fully adaptive
 * selection. This shifts the STARTING band — recent-performance adaptation
 * (chooseTargetBandIndex) still applies on top of it.
 */
export function placementTargetShift(placementRemaining: number): number {
  const remaining = normalizeRemaining(placementRemaining)
  if (remaining <= 0) return 0
  if (remaining >= 4) return 2 // matches 1-2: rookie/starter territory
  if (remaining >= 2) return 1 // matches 3-4: one band below estimate
  return 0 // final placement match: fully adaptive
}
