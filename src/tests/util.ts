/* c8 ignore start */
export function ok(value: unknown) {
    assert<unknown>(value);
}

export function assert<T>(value: unknown, message?: string): asserts value is T {
    if (!value) throw new Error(message);
}