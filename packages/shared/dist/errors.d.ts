export declare class AppError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly retryable: boolean;
    constructor(code: string, message: string, statusCode?: number, retryable?: boolean);
}
export declare const ErrorCodes: {
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly CONFLICT: "CONFLICT";
    readonly VALIDATION: "VALIDATION";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly ALREADY_IN_QUEUE: "ALREADY_IN_QUEUE";
    readonly NOT_IN_QUEUE: "NOT_IN_QUEUE";
    readonly ALREADY_IN_MATCH: "ALREADY_IN_MATCH";
    readonly MATCH_NOT_ACTIVE: "MATCH_NOT_ACTIVE";
    readonly IDEMPOTENCY_REPLAY: "IDEMPOTENCY_REPLAY";
    readonly INTERNAL: "INTERNAL";
};
//# sourceMappingURL=errors.d.ts.map