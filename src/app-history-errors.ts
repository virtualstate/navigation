export class InvalidStateError extends Error {
    constructor(message?: string) {
        super(`InvalidStateError${message ? `: ${message}` : ""}`);
    }
}

export interface AbortError extends Error {

}

export class AbortError extends Error {
    name = "AbortError"
}

export function isAbortError(error: Error): error is AbortError {
    return error.name === "AbortError"
}