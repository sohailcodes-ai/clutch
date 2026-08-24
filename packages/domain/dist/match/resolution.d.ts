import type { Redis } from 'ioredis';
import type { Database } from '@clutch/db';
import { schema } from '@clutch/db';
type ResolvedMatch = typeof schema.matches.$inferSelect;
/**
 * Authoritative match resolution.
 *
 * Exactly-once guarantees:
 * - The terminal state transition is guarded by an optimistic version check;
 *   if another resolver committed first, the update affects zero rows and we
 *   return the already-resolved match without touching ratings again.
 * - Rating updates, participant results and ledger entries happen inside the
 *   same transaction as the state transition.
 * - Realtime events are published strictly AFTER the transaction commits, so
 *   subscribers never observe uncommitted competitive state.
 */
export declare function resolveMatch(db: Database, redis: Redis, matchId: string): Promise<ResolvedMatch | null>;
export declare function normalizedShingles(code: string): string[];
/**
 * Pure bounded similarity score in [0,1]: Jaccard overlap of character-level
 * shingle sets. Inputs are hard-capped so a malicious submission cannot make
 * resolution spend unbounded time or memory.
 */
export declare function similarityScore(aShingles: string[], bShingles: string[]): number;
export declare function detectSubmissionSimilarity(db: Database, matchId: string): Promise<void>;
export type AdjudicationInput = {
    matchId: string;
    winnerUserId: string;
    reason: string;
};
export type AdjudicationCandidate = {
    status: string;
    participants: readonly {
        userId: string;
    }[];
};
/**
 * Pure validation for administrative overrides — unit-testable and
 * deterministic. Enforces: a substantive reason, a winner that is one of the
 * EXACT two participants, and a non-terminal adjudicable state (which also
 * makes duplicate adjudication impossible).
 */
export declare function validateAdjudication(candidate: AdjudicationCandidate, input: AdjudicationInput): {
    ok: true;
} | {
    ok: false;
    code: string;
    message: string;
};
/**
 * Administrative result override.
 *
 * Reuses the SAME exactly-once machinery as automatic resolution:
 * - optimistic version-guarded terminal transition (duplicate adjudications
 *   and races with the normal resolver are rejected/absorbed safely),
 * - `applyJudgedOutcome` performs the ELO/rating-ledger/participant updates
 *   under the established competitive rules (including the ranked flag),
 * - audit record + match events are written inside the same transaction,
 * - realtime publication happens strictly after commit.
 *
 * The override is distinguishable forever via `resolveReason = 'adjudicated'`.
 */
export declare function adjudicateMatch(db: Database, redis: Redis, input: AdjudicationInput & {
    adminUserId: string;
}): Promise<ResolvedMatch>;
export {};
//# sourceMappingURL=resolution.d.ts.map