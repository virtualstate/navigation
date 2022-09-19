export function isPromise<T>(value: unknown): value is Promise<T> {
    function isPromiseLike(value: unknown): value is Promise<unknown> {
        return !!value
    }
    return (
        isPromiseLike(value) &&
        typeof value.then === "function"
    )
}