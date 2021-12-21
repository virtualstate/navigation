export function ok(value: unknown) {
    assert(value);
}

export function assert(value: unknown, message?: string): asserts value {
    if (!value) throw new Error(message);
}