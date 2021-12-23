export interface AbortError extends Error {
    // Shown here
    // https://dom.spec.whatwg.org/#aborting-ongoing-activities
    // https://webidl.spec.whatwg.org/#aborterror
    name: "AbortError";
}

export class AbortError extends Error {
    name = "AbortError" as const
}

export function isAbortError(error: unknown): error is AbortError {
    return error instanceof Error && error.name === "AbortError"
}

export interface InvalidStateError extends Error {
    // Following how AbortError is named
    name: "InvalidStateError";
}

export class InvalidStateError extends Error {
    name = "InvalidStateError" as const;

    constructor(message?: string) {
        super(`InvalidStateError${message ? `: ${message}` : ""}`);
    }
}

export function isInvalidStateError(error: unknown): error is InvalidStateError {
    return error instanceof Error && error.name === "AbortError"
}