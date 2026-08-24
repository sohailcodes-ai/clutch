import type { Database } from '@clutch/db';
import { type CreateRoomInput } from '@clutch/shared';
export declare function createRoom(db: Database, hostUserId: string, input: CreateRoomInput): Promise<{
    id: string;
    status: "open" | "in_progress" | "closed";
    createdAt: Date;
    updatedAt: Date;
    name: string;
    stackId: string;
    difficultyId: string | null;
    timeLimitSec: number;
    publicId: string;
    ranked: boolean;
    hostUserId: string;
    maxPlayers: number;
    isPublic: boolean;
    questionSelectionMode: string;
    joinCode: string | null;
}>;
export declare function joinRoom(db: Database, roomId: string, userId: string, joinCode?: string): Promise<{
    room: {
        id: string;
        status: "open" | "in_progress" | "closed";
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stackId: string;
        difficultyId: string | null;
        timeLimitSec: number;
        publicId: string;
        ranked: boolean;
        hostUserId: string;
        maxPlayers: number;
        isPublic: boolean;
        questionSelectionMode: string;
        joinCode: string | null;
    };
    joined: boolean;
}>;
export declare function leaveRoom(db: Database, roomId: string, userId: string): Promise<{
    left: boolean;
}>;
export declare function setRoomReady(db: Database, roomId: string, userId: string, ready: boolean): Promise<{
    ready: boolean;
}>;
/** Sanitized room detail — exposes handles/avatars only, never join codes of
 *  rooms you do not host, never emails or internal identifiers. */
export declare function getRoomDetail(db: Database, roomId: string, viewerUserId?: string): Promise<{
    id: string;
    publicId: string;
    name: string;
    hostHandle: string | null;
    stackId: string;
    stackName: string;
    difficultyId: string | null;
    difficultyLabel: string | null;
    maxPlayers: number;
    isPublic: boolean;
    ranked: boolean;
    timeLimitSec: number;
    questionSelectionMode: string;
    status: "open" | "in_progress" | "closed";
    createdAt: string;
    /** Join code is ONLY ever visible to the hosting user. */
    joinCode: string | null | undefined;
    players: {
        handle: string;
        displayName: string | null;
        avatarUrl: string | null;
        isHost: boolean;
        readyAt: string | null;
        joinedAt: string;
    }[];
} | null>;
export declare function listOpenRooms(db: Database, limit?: number, offset?: number): Promise<{
    id: string;
    publicId: string;
    name: string;
    stackId: string;
    stackName: string;
    difficultyId: string | null;
    difficultyLabel: string | null;
    ranked: boolean;
    playerCount: number;
    maxPlayers: number;
}[]>;
/**
 * Starts a real duel from a room lobby using the EXISTING match pipeline:
 * question selection, match creation and resolution are shared with ranked
 * matchmaking. Unranked rooms produce matches that never touch ELO.
 */
export declare function startRoomMatch(db: Database, redis: import('ioredis').Redis, seasonId: string, roomId: string, requesterUserId: string): Promise<{
    id: string;
    status: "active" | "queued" | "matched" | "starting" | "evaluating" | "resolved" | "cancelled" | "abandoned" | "draw";
    createdAt: Date;
    endsAt: Date | null;
    stackId: string;
    seasonId: string;
    difficultyId: string;
    timeLimitSec: number;
    version: number;
    questionVersionId: string;
    publicId: string;
    startedAt: Date | null;
    resolvedAt: Date | null;
    winnerUserId: string | null;
    resolveReason: string | null;
    ranked: boolean;
    roomId: string | null;
    eventId: string | null;
    tournamentId: string | null;
}>;
//# sourceMappingURL=service.d.ts.map