import type { Database } from '@clutch/db';
import { type RegisterInput, type LoginInput } from '@clutch/shared';
export declare function generateSessionToken(): string;
export declare function registerUser(db: Database, input: RegisterInput, meta?: {
    ipAddress?: string;
    userAgent?: string;
}): Promise<{
    user: {
        id: string;
        email: string;
        passwordHash: string;
        emailVerifiedAt: Date | null;
        status: "active" | "suspended" | "banned";
        role: string;
        createdAt: Date;
        updatedAt: Date;
    };
    token: string;
    expiresAt: Date;
}>;
export declare function loginUser(db: Database, input: LoginInput, meta?: {
    ipAddress?: string;
    userAgent?: string;
}): Promise<{
    user: {
        id: string;
        email: string;
        passwordHash: string;
        emailVerifiedAt: Date | null;
        status: "active" | "suspended" | "banned";
        role: string;
        createdAt: Date;
        updatedAt: Date;
    };
    token: string;
    expiresAt: Date;
}>;
export declare function logoutUser(db: Database, token: string): Promise<void>;
export declare function getSessionUser(db: Database, token: string): Promise<{
    id: string;
    email: string;
    passwordHash: string;
    emailVerifiedAt: Date | null;
    status: "active" | "suspended" | "banned";
    role: string;
    createdAt: Date;
    updatedAt: Date;
    profile: {
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        handle: string;
        displayName: string | null;
        avatarUrl: string | null;
        region: string;
        bio: string | null;
        equippedTitleId: string | null;
        onboardingCompletedAt: Date | null;
        primaryStackId: string | null;
    };
} | null>;
export declare function getUserByHandle(db: Database, handle: string): Promise<{
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    region: string;
    bio: string | null;
    equippedTitleId: string | null;
    onboardingCompletedAt: Date | null;
    primaryStackId: string | null;
    user: {
        id: string;
        email: string;
        passwordHash: string;
        emailVerifiedAt: Date | null;
        status: "active" | "suspended" | "banned";
        role: string;
        createdAt: Date;
        updatedAt: Date;
    };
} | null>;
//# sourceMappingURL=service.d.ts.map