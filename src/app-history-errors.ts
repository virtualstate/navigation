export class InvalidStateError extends Error {
    constructor(message?: string) {
        super(`InvalidStateError${message ? `: ${message}` : ""}`);
    }
}

export interface AbortError extends Error {

}

export class AppHistoryAbortError extends Error implements AbortError {
    constructor(message?: string) {
        super(`AppHistoryAppError${message ? `: ${message}` : ""}`);
    }
}

export class AppRollbackError extends AppHistoryAbortError {

}