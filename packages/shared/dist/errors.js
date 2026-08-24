export class AppError extends Error {
    code;
    statusCode;
    retryable;
    constructor(code, message, statusCode = 400, retryable = false) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.retryable = retryable;
        this.name = 'AppError';
    }
}
export const ErrorCodes = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    VALIDATION: 'VALIDATION',
    RATE_LIMITED: 'RATE_LIMITED',
    ALREADY_IN_QUEUE: 'ALREADY_IN_QUEUE',
    NOT_IN_QUEUE: 'NOT_IN_QUEUE',
    ALREADY_IN_MATCH: 'ALREADY_IN_MATCH',
    MATCH_NOT_ACTIVE: 'MATCH_NOT_ACTIVE',
    IDEMPOTENCY_REPLAY: 'IDEMPOTENCY_REPLAY',
    INTERNAL: 'INTERNAL',
};
//# sourceMappingURL=errors.js.map