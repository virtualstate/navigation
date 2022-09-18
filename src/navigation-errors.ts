export interface AbortError extends Error {
  // Shown here
  // https://dom.spec.whatwg.org/#aborting-ongoing-activities
  // https://webidl.spec.whatwg.org/#aborterror
  name: "AbortError";
}

export class AbortError extends Error {
  constructor(message?: string) {
    super(`AbortError${message ? `: ${message}` : ""}`);
    this.name = "AbortError";
  }
}

export function isAbortError(error: unknown): error is AbortError {
  return error instanceof Error && error.name === "AbortError";
}

export interface InvalidStateError extends Error {
  // Following how AbortError is named
  name: "InvalidStateError";
}

export class InvalidStateError extends Error {
  constructor(message?: string) {
    super(`InvalidStateError${message ? `: ${message}` : ""}`);
    this.name = "InvalidStateError";
  }
}

export function isInvalidStateError(
  error: unknown
): error is InvalidStateError {
  return error instanceof Error && error.name === "InvalidStateError";
}
