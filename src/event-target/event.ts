export interface Event<Name extends string | symbol = string | symbol> {
  type: Name;
  parallel?: boolean;
  signal?: {
    aborted: boolean;
  };
  [key: string]: unknown;
  [key: number]: unknown;

  originalEvent?: Event
}

export function isEvent(value: unknown): value is Event {
  function isLike(value: unknown): value is { type: unknown } {
    return !!value;
  }
  return (
    isLike(value) &&
    (typeof value.type === "string" || typeof value.type === "symbol")
  );
}

export function assertEvent<E extends Event>(
    value: unknown,
    type?: E["type"]
): asserts value is E {
  if (!isEvent(value)) {
    throw new Error("Expected event");
  }
  if (typeof type !== "undefined" && value.type !== type) {
    throw new Error(
      `Expected event type ${String(type)}, got ${value.type.toString()}`
    );
  }
}
