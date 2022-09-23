export function isPromise<T>(value: unknown): value is Promise<T> {
    return (
        like<Promise<unknown>>(value) &&
        typeof value.then === "function"
    )
}

export function ok(value: unknown, message?: string): asserts value
export function ok<T>(value: unknown, message?: string): asserts value is T
export function ok(value: unknown, message = "Expected value"): asserts value {
    if (!value) {
        throw new Error(message);
    }
}

export function isPromiseRejectedResult(value: PromiseSettledResult<unknown>): value is PromiseRejectedResult {
    return value.status === "rejected";
}

export function like<T>(value: unknown): value is T {
    return !!value;
}