import { z } from 'zod';
export declare const createEventSchema: z.ZodObject<{
    slug: z.ZodString;
    name: z.ZodString;
    descriptionMd: z.ZodOptional<z.ZodString>;
    rulesMd: z.ZodOptional<z.ZodString>;
    startsAt: z.ZodDate;
    endsAt: z.ZodDate;
    stackIds: z.ZodArray<z.ZodString, "many">;
    allowedDifficultyIds: z.ZodArray<z.ZodString, "many">;
    maxParticipants: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    rewardTitleCodes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    slug: string;
    name: string;
    maxParticipants: number | null;
    startsAt: Date;
    endsAt: Date;
    stackIds: string[];
    allowedDifficultyIds: string[];
    rewardTitleCodes: string[];
    descriptionMd?: string | undefined;
    rulesMd?: string | undefined;
}, {
    slug: string;
    name: string;
    startsAt: Date;
    endsAt: Date;
    stackIds: string[];
    allowedDifficultyIds: string[];
    descriptionMd?: string | undefined;
    maxParticipants?: number | null | undefined;
    rulesMd?: string | undefined;
    rewardTitleCodes?: string[] | undefined;
}>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export declare const eventSlugParamsSchema: z.ZodObject<{
    slug: z.ZodString;
}, "strip", z.ZodTypeAny, {
    slug: string;
}, {
    slug: string;
}>;
export declare const listEventsQuerySchema: z.ZodObject<{
    phase: z.ZodDefault<z.ZodEnum<["upcoming", "active", "ended", "all"]>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    phase: "active" | "upcoming" | "ended" | "all";
}, {
    limit?: number | undefined;
    offset?: number | undefined;
    phase?: "active" | "upcoming" | "ended" | "all" | undefined;
}>;
/**
 * Authoritative event phase derived ONLY from server wall-clock time and the
 * stored publish status. Clients never compute or fake these phases.
 */
export declare function eventPhase(now: Date, event: {
    startsAt: Date;
    endsAt: Date;
}): 'upcoming' | 'active' | 'ended';
/** Deterministic registration window check (server time only). */
export declare function canRegisterForEvent(now: Date, event: {
    startsAt: Date;
    endsAt: Date;
}): {
    ok: true;
} | {
    ok: false;
    reason: string;
};
//# sourceMappingURL=events.d.ts.map