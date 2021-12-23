import {isEvent, Event} from "./event";

export interface TransitionEvent<Name extends string | symbol = string, T = unknown> extends Event<Name> {
    /**
     * @param value
     * @throws InvalidStateError
     */
    transitionWhile(value: T | Promise<T>): void
}

export function isTransitionEvent<T = unknown>(value: object): value is TransitionEvent<string | symbol, T> {
    function isTransitionEventLike(value: object): value is Partial<Record<keyof TransitionEvent, unknown>> {
        return isEvent(value)
    }
    return (
        isTransitionEventLike(value) &&
        typeof value.transitionWhile === "function"
    )
}
