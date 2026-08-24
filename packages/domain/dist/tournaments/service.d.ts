import type { Database } from '@clutch/db';
import { type CreateTournamentInput } from '@clutch/shared';
/**
 * Tournament FOUNDATION. Provides tournaments, registrations, rounds and
 * match association (matches.tournament_id). Full automated bracket
 * generation/seeding is intentionally out of scope for this increment; the
 * data model and registration lifecycle here are the contract that bracket
 * automation will build on. See "Remaining work" in the repo report.
 */
export declare function createTournament(db: Database, input: CreateTournamentInput): Promise<{
    id: string;
    status: "cancelled" | "running" | "draft" | "completed" | "registration_open" | "seeding";
    createdAt: Date;
    name: string;
    startsAt: Date;
    endsAt: Date | null;
    stackId: string;
    seasonId: string;
    slug: string;
    descriptionMd: string | null;
    maxParticipants: number;
    rewardTitleIds: unknown;
    format: "single_elimination" | "double_elimination" | "round_robin";
    registrationOpensAt: Date;
    registrationClosesAt: Date;
    championUserId: string | null;
} | undefined>;
export declare function listTournaments(db: Database, limit?: number, offset?: number): Promise<{
    id: string;
    slug: string;
    name: string;
    descriptionMd: string | null;
    format: "single_elimination" | "double_elimination" | "round_robin";
    status: "cancelled" | "running" | "draft" | "completed" | "registration_open" | "seeding";
    stackId: string;
    stackName: string;
    maxParticipants: number;
    registeredCount: number;
    registrationOpensAt: string;
    registrationClosesAt: string;
    startsAt: string;
    endsAt: string | null;
    championHandle: string | null;
    serverTimeMs: number;
}[]>;
export declare function getTournament(db: Database, slug: string): Promise<{
    id: string;
    slug: string;
    name: string;
    descriptionMd: string | null;
    format: "single_elimination" | "double_elimination" | "round_robin";
    status: "cancelled" | "running" | "draft" | "completed" | "registration_open" | "seeding";
    stackId: string;
    stackName: string;
    maxParticipants: number;
    registeredCount: number;
    registrationOpensAt: string;
    registrationClosesAt: string;
    startsAt: string;
    endsAt: string | null;
    championHandle: string | null;
    rounds: {
        roundNumber: number;
        name: string;
        status: "running" | "completed" | "pending" | "ready";
    }[];
    serverTimeMs: number;
} | null>;
export declare function registerForTournament(db: Database, slug: string, userId: string): Promise<{
    registered: boolean;
}>;
export declare function unregisterForTournament(db: Database, slug: string, userId: string): Promise<{
    unregistered: boolean;
}>;
export declare function listParticipants(db: Database, slug: string): Promise<{
    handle: string;
    avatarUrl: string | null;
    seed: number | null;
    registeredAt: string;
}[]>;
/** Creates the round skeleton once registration closes (admin action). */
export declare function seedRounds(db: Database, slug: string, roundNames?: string[]): Promise<{
    id: string;
    status: "running" | "completed" | "pending" | "ready";
    name: string;
    startsAt: Date | null;
    tournamentId: string;
    roundNumber: number;
}[]>;
//# sourceMappingURL=service.d.ts.map