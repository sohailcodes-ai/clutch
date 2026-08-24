import { createDb, closeDb } from './client.js';
import { bootstrapAdmin } from '@clutch/domain';
/**
 * One-time administrator bootstrap (CLI ONLY — never exposed over HTTP).
 *
 * Usage:
 *   CLUTCH_ADMIN_HANDLE=sami CLUTCH_ADMIN_PASSWORD=<secret> pnpm --filter @clutch/db bootstrap:admin
 *
 * The plaintext password is read from the environment, hashed with bcrypt,
 * and never stored, logged or returned.
 */
async function main() {
    const handle = process.env.CLUTCH_ADMIN_HANDLE;
    const password = process.env.CLUTCH_ADMIN_PASSWORD;
    if (!handle || !password) {
        console.error('CLUTCH_ADMIN_HANDLE and CLUTCH_ADMIN_PASSWORD environment variables are required');
        process.exit(1);
    }
    const url = process.env.DATABASE_URL;
    if (!url)
        throw new Error('DATABASE_URL is required');
    const db = createDb(url);
    try {
        const result = await bootstrapAdmin(db, { handle, password });
        // Deliberately vague output: never echo credential material.
        if (result.created) {
            console.log(`Admin account created for "${handle}"`);
        }
        else if (result.promoted) {
            console.log(`Existing account "${handle}" promoted to super_admin`);
        }
        else {
            console.log(`Admin account "${handle}" already provisioned — no changes made`);
        }
    }
    finally {
        await closeDb();
    }
}
main().catch((err) => {
    console.error('Bootstrap failed');
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
//# sourceMappingURL=bootstrap-admin.js.map