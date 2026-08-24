import type { Database } from '@clutch/db';
export declare function rolloverSeason(db: Database): Promise<{
    number: number;
    id: string;
    status: "active" | "upcoming" | "archived";
    name: string;
    title: string | null;
    startsAt: Date;
    endsAt: Date;
    softResetFactor: string;
    decayAfterDays: number;
    placementMatches: number;
} | null>;
export declare function applyRatingDecay(db: Database, decayAfterDays: number): Promise<void>;
//# sourceMappingURL=service.d.ts.map