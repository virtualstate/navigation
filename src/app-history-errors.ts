export class InvalidStateError extends Error {
    constructor(message?: string) {
        super(`InvalidStateError${message ? `: ${message}` : ""}`);
    }
}