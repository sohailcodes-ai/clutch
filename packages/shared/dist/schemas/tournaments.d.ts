import { z } from 'zod';
export declare const createTournamentSchema: z.ZodObject<{
    slug: z.ZodString;
    name: z.ZodString;
    descriptionMd: z.ZodOptional<z.ZodString>;
    format: z.ZodDefault<z.ZodEnum<["single_elimination", "double_elimination", "round_robin"]>>;
    stackId: z.ZodString;
    maxParticipants: z.ZodNumber;
    registrationOpensAt: z.ZodDate;
    registrationClosesAt: z.ZodDate;
    startsAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    slug: string;
    name: string;
    format: "single_elimination" | "double_elimination" | "round_robin";
    stackId: string;
    maxParticipants: number;
    registrationOpensAt: Date;
    registrationClosesAt: Date;
    startsAt: Date;
    descriptionMd?: string | undefined;
}, {
    slug: string;
    name: string;
    stackId: string;
    maxParticipants: number;
    registrationOpensAt: Date;
    registrationClosesAt: Date;
    startsAt: Date;
    descriptionMd?: string | undefined;
    format?: "single_elimination" | "double_elimination" | "round_robin" | undefined;
}>;
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export declare const tournamentSlugParamsSchema: z.ZodObject<{
    slug: z.ZodString;
}, "strip", z.ZodTypeAny, {
    slug: string;
}, {
    slug: string;
}>;
/**
 * Pure, deterministic registration eligibility check. The window is evaluated
 * against SERVER time only; capacity against the stored participant cap.
 */
export declare function canRegisterForTournament(now: Date, tournament: {
    status: string;
    registrationOpensAt: Date;
    registrationClosesAt: Date;
    startsAt: Date;
    maxParticipants: number;
    registeredCount: number;
}): {
    ok: true;
} | {
    ok: false;
    reason: string;
};
//# sourceMappingURL=tournaments.d.ts.map