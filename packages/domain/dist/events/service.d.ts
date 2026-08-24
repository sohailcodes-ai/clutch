import type { Database } from '@clutch/db';
import { type CreateEventInput } from '@clutch/shared';
export declare function createEvent(db: Database, input: CreateEventInput): Promise<{
    id: string;
    status: "cancelled" | "draft" | "published" | "completed";
    createdAt: Date;
    name: string;
    startsAt: Date;
    endsAt: Date;
    slug: string;
    descriptionMd: string | null;
    rulesMd: string | null;
    maxParticipants: number | null;
    rewardTitleIds: unknown;
}>;
/** Public listing with authoritative phase computed from server time. */
export declare function listEvents(db: Database, opts?: {
    phase?: 'upcoming' | 'active' | 'ended' | 'all';
    limit?: number;
    offset?: number;
}): Promise<{
    id: string;
    slug: string;
    name: string;
    descriptionMd: string | null;
    rulesMd: string | null;
    startsAt: string;
    endsAt: string;
    phase: "active" | "upcoming" | "ended";
    maxParticipants: number | null;
    stackIds: string[];
    difficultyIds: string[];
    serverTimeMs: number;
}[]>;
export declare function getEvent(db: Database, slug: string): Promise<{
    id: string;
    slug: string;
    name: string;
    descriptionMd: string | null;
    rulesMd: string | null;
    startsAt: string;
    endsAt: string;
    phase: "active" | "upcoming" | "ended";
    serverTimeMs: number;
    maxParticipants: number | null;
    registeredCount: number;
    stackIds: string[];
    difficultyIds: string[];
} | null>;
export declare function registerForEvent(db: Database, slug: string, userId: string): Promise<{
    registered: boolean;
    serverTimeMs: number;
}>;
export declare function unregisterForEvent(db: Database, slug: string, userId: string): Promise<{
    unregistered: boolean;
}>;
/** Standings from resolved matches associated with this event. */
export declare function getEventStandings(db: Database, slug: string, limit?: number): Promise<{
    handle: string | null;
    avatarUrl: string | null;
    points: number;
    wins: number;
    games: number;
}[]>;
//# sourceMappingURL=service.d.ts.map