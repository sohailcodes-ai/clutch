import { z } from 'zod';
/** Client-reported editor telemetry for anti-cheat analysis. Never trusted
 *  as proof of cheating on its own — it only feeds server-side review flags. */
export declare const editorTelemetrySchema: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["paste", "drop", "copy", "blur", "focus"]>;
        atMs: z.ZodNumber;
        length: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        kind: "paste" | "drop" | "copy" | "blur" | "focus";
        atMs: number;
        length?: number | undefined;
    }, {
        kind: "paste" | "drop" | "copy" | "blur" | "focus";
        atMs: number;
        length?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    events: {
        kind: "paste" | "drop" | "copy" | "blur" | "focus";
        atMs: number;
        length?: number | undefined;
    }[];
}, {
    events: {
        kind: "paste" | "drop" | "copy" | "blur" | "focus";
        atMs: number;
        length?: number | undefined;
    }[];
}>;
export type EditorTelemetryInput = z.infer<typeof editorTelemetrySchema>;
export declare const publicProfileSchema: z.ZodObject<{
    handle: z.ZodString;
}, "strip", z.ZodTypeAny, {
    handle: string;
}, {
    handle: string;
}>;
export declare const secureAvatarUrl: z.ZodEffects<z.ZodString, string, string>;
export declare const updateProfileSchemaWithSecureAvatar: z.ZodObject<{
    handle: z.ZodOptional<z.ZodString>;
    displayName: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    handle?: string | undefined;
    displayName?: string | undefined;
    avatarUrl?: string | undefined;
    region?: string | undefined;
    bio?: string | undefined;
}, {
    handle?: string | undefined;
    displayName?: string | undefined;
    avatarUrl?: string | undefined;
    region?: string | undefined;
    bio?: string | undefined;
}>;
//# sourceMappingURL=progression.d.ts.map