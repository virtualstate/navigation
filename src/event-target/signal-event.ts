import { Event, isEvent } from "./event"
import type { SyncEventTarget } from "./event-target"
import type { SyncEventCallback } from "./callback";

export interface AbortSignal extends SyncEventTarget {
    aborted: boolean
    addEventListener(type: "abort", callback: SyncEventCallback): void
    addEventListener(type: string, callback: SyncEventCallback): void
}

export interface AbortController {
    signal: AbortSignal
    abort(): void
}

export interface SignalEvent<Name extends string = string> extends Event<Name> {
    signal: AbortSignal
}

export function isAbortSignal(value: unknown): value is AbortSignal {
    function isAbortSignalLike(value: unknown): value is Partial<Record<keyof AbortSignal, unknown>> {
        return typeof value === "object"
    }
    return (
        isAbortSignalLike(value) &&
        typeof value.aborted === "boolean" &&
        typeof value.addEventListener === "function"
    )
}

export function isAbortController(value: unknown): value is AbortController {
    function isAbortControllerLike(value: unknown): value is Partial<Record<keyof AbortController, unknown>> {
        return typeof value === "object"
    }
    return (
        isAbortControllerLike(value) &&
        typeof value.abort === "function" &&
        isAbortSignal(value.signal)
    )
}

export function isSignalEvent(value: object): value is SignalEvent {
    function isSignalEventLike(value: object): value is { signal?: unknown } {
        return value.hasOwnProperty("signal")
    }
    return (
        isEvent(value) &&
        isSignalEventLike(value) &&
        isAbortSignal(value.signal)
    )
}
