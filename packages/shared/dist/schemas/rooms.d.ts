import { z } from 'zod';
/** Server-side validation for competitive room configuration. */
export declare const createRoomSchema: z.ZodObject<{
    name: z.ZodString;
    stackId: z.ZodString;
    difficultyId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    maxPlayers: z.ZodDefault<z.ZodNumber>;
    isPublic: z.ZodDefault<z.ZodBoolean>;
    ranked: z.ZodDefault<z.ZodBoolean>;
    timeLimitSec: z.ZodDefault<z.ZodNumber>;
    questionSelectionMode: z.ZodDefault<z.ZodEnum<["random", "adaptive"]>>;
}, "strip", z.ZodTypeAny, {
    ranked: boolean;
    name: string;
    stackId: string;
    difficultyId: string | null;
    maxPlayers: number;
    isPublic: boolean;
    timeLimitSec: number;
    questionSelectionMode: "random" | "adaptive";
}, {
    name: string;
    stackId: string;
    ranked?: boolean | undefined;
    difficultyId?: string | null | undefined;
    maxPlayers?: number | undefined;
    isPublic?: boolean | undefined;
    timeLimitSec?: number | undefined;
    questionSelectionMode?: "random" | "adaptive" | undefined;
}>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export declare const joinRoomSchema: z.ZodObject<{
    joinCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    joinCode?: string | undefined;
}, {
    joinCode?: string | undefined;
}>;
export declare const roomIdParamsSchema: z.ZodObject<{
    roomId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roomId: string;
}, {
    roomId: string;
}>;
export declare const listRoomsQuerySchema: z.ZodObject<{
    status: z.ZodDefault<z.ZodEnum<["open", "in_progress", "closed"]>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "open" | "in_progress" | "closed";
    limit: number;
    offset: number;
}, {
    status?: "open" | "in_progress" | "closed" | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
/**
 * Pure structural validation of room configuration, independent of the DB.
 * Used by the domain service before any persistence happens.
 */
export declare function validateRoomConfig(config: CreateRoomInput): {
    ok: true;
} | {
    ok: false;
    reason: string;
};
//# sourceMappingURL=rooms.d.ts.map