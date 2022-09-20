export function isPromise<T>(value: unknown): value is Promise<T> {
    function isPromiseLike(value: unknown): value is Promise<unknown> {
        return !!value
    }
    return (
        isPromiseLike(value) &&
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