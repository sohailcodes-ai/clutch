import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { schema } from '@clutch/db';
import { AppError, DEFAULT_RATING, ErrorCodes, PLACEMENT_MATCHES } from '@clutch/shared';
import { writeAuditLog } from '../audit.js';
/**
 * One-time secure administrator bootstrap.
 *
 * Credentials arrive through environment variables (CLUTCH_ADMIN_HANDLE /
 * CLUTCH_ADMIN_PASSWORD) and are NEVER stored in plaintext, logged, returned
 * by an API, or shipped to frontend code. The password is hashed with the
 * same bcrypt scheme as player accounts before it touches the database.
 *
 * Re-running the bootstrap is safe: an existing account with the bootstrap
 * handle is PROMOTED to SUPER_ADMIN rather than duplicated.
 */
const BCRYPT_ROUNDS = 12;
/** Deterministic internal email for handle-only bootstrap identities. */
export function deriveAdminEmail(handle) {
    return `${handle.toLowerCase()}@admins.clutch.local`;
}
export async function bootstrapAdmin(db, input) {
    const handle = input.handle.trim();
    if (handle.length < 3 || handle.length > 24 || !/^[a-zA-Z0-9_]+$/.test(handle)) {
        throw new AppError(ErrorCodes.VALIDATION, 'Invalid admin handle', 400);
    }
    if (input.password.length < 8) {
        throw new AppError(ErrorCodes.VALIDATION, 'Admin password too short', 400);
    }
    const existingProfile = await db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.handle, handle),
        with: { user: true },
    });
    if (existingProfile) {
        if (existingProfile.user.role === 'super_admin') {
            return { created: false, promoted: false, userId: existingProfile.userId };
        }
        await db
            .update(schema.users)
            .set({ role: 'super_admin' })
            .where(eq(schema.users.id, existingProfile.userId));
        await writeAuditLog(db, {
            actorUserId: existingProfile.userId,
            action: 'admin.bootstrapped',
            resourceType: 'user',
            resourceId: existingProfile.userId,
            metadata: { promotedFrom: existingProfile.user.role },
        });
        return { created: false, promoted: true, userId: existingProfile.userId };
    }
    // Hash BEFORE any persistence; the plaintext never leaves this scope.
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const userId = await db.transaction(async (tx) => {
        const [created] = await tx
            .insert(schema.users)
            .values({
            email: deriveAdminEmail(handle),
            passwordHash,
            role: 'super_admin',
        })
            .returning();
        if (!created)
            throw new AppError(ErrorCodes.INTERNAL, 'Failed to create admin user', 500);
        await tx.insert(schema.userProfiles).values({
            userId: created.id,
            handle,
            displayName: handle,
        });
        const stacks = await tx.query.stacks.findMany({ where: eq(schema.stacks.isActive, true) });
        if (stacks.length > 0) {
            await tx.insert(schema.userStackRatings).values(stacks.map((stack) => ({
                userId: created.id,
                stackId: stack.id,
                rating: DEFAULT_RATING,
                tierId: 'silver',
                placementRemaining: PLACEMENT_MATCHES,
                peakRating: DEFAULT_RATING,
            })));
        }
        await writeAuditLog(tx, {
            actorUserId: created.id,
            action: 'admin.bootstrapped',
            resourceType: 'user',
            resourceId: created.id,
            metadata: { created: true },
        });
        return created.id;
    });
    return { created: true, promoted: false, userId };
}
//# sourceMappingURL=bootstrap.js.map