import { isEvent, Event } from "./event";

export interface InterceptEvent<
  Name extends string | symbol = string,
  T = unknown
> extends Event<Name> {
  /**
   * @param value
   * @throws InvalidStateError
   */
  intercept(value: T | Promise<T>): void;
  transitionWhile?(value: T | Promise<T>): void;
}

export function isInterceptEvent<T = unknown>(
  value: object
): value is InterceptEvent<string | symbol, T> {
  function isInterceptEventLike(
    value: object
  ): value is Partial<Record<keyof InterceptEvent, unknown>> {
    return isEvent(value);
  }
  return (
      isInterceptEventLike(value) && typeof value.intercept === "function"
  );
}
