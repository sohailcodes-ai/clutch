import type { Database } from '@clutch/db';
/** Deterministic internal email for handle-only bootstrap identities. */
export declare function deriveAdminEmail(handle: string): string;
export declare function bootstrapAdmin(db: Database, input: {
    handle: string;
    password: string;
}): Promise<{
    created: boolean;
    promoted: boolean;
    userId: string;
}>;
//# sourceMappingURL=bootstrap.d.ts.map