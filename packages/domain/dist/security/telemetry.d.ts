import type { DbExecutor } from '@clutch/db';
/**
 * Anti-cheat editor telemetry.
 *
 * Clients report bounded paste/drop/copy/blur events. This data is NEVER
 * treated as proof of cheating on its own — it accumulates server-side and
 * only creates review flags when thresholds are exceeded, for human/automated
 * review alongside submission-similarity evidence.
 */
export type TelemetrySummary = {
    pasteCount: number;
    dropCount: number;
    copyCount: number;
    blurCount: number;
    focusCount: number;
};
export declare function recordEditorTelemetry(db: DbExecutor, input: {
    matchId: string;
    userId: string;
    events: {
        kind: 'paste' | 'drop' | 'copy' | 'blur' | 'focus';
        atMs: number;
        length?: number;
    }[];
}): Promise<TelemetrySummary>;
//# sourceMappingURL=telemetry.d.ts.map