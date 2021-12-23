import { Event } from "./event"
import { EventListener } from "./context"
import { EventCallback, SyncEventCallback } from "./callback"
import { EventDescriptor, EventDescriptorSymbol } from "./descriptor"
import { matchEventCallback } from "./callback"
import { isParallelEvent } from "./parallel-event"
import { isSignalEvent } from "./signal-event"
import { AbortError, isAbortError } from "../app-history-errors"

export type {
    EventCallback
}

export interface EventTargetAddListenerOptions extends Pick<EventDescriptor, "once"> {

}

/**
 * @experimental
 */
export const EventTargetListeners = Symbol.for("@opennetwork/environment/events/target/listeners");

export interface SyncEventTarget<Event = unknown, This = unknown> {
    addEventListener(type: string, callback: SyncEventCallback<Event, This>, options?: EventTargetAddListenerOptions): void
    removeEventListener(type: string, callback: SyncEventCallback<Event, This>, options?: unknown): void
    dispatchEvent(event: Event): void
}

export interface EventTarget<This = unknown> extends SyncEventTarget<Event, This> {
    addEventListener(type: string | symbol, callback: EventCallback<Event, This>, options?: EventTargetAddListenerOptions): void
    removeEventListener(type: string | symbol, callback: Function, options?: unknown): void
    hasEventListener(type: string | symbol, callback?: Function): Promise<boolean>
    dispatchEvent(event: Event): void | Promise<void>
}

function isFunctionEventCallback(fn: Function): fn is EventCallback {
    return typeof fn === "function"
}

// export type AddEventListenerFn = EventTarget["addEventListener"]
// export type RemoveEventListenerFn = EventTarget["removeEventListener"]
// export type DispatchEventListenerFn = EventTarget["dispatchEvent"]
// export type HasEventListenerFn = EventTarget["hasEventListener"]

export class EventTarget implements EventTarget {

    #listeners: EventDescriptor[] = [];
    #ignoreExternalListener = new WeakSet<EventDescriptor>();

    readonly #thisValue: unknown

    constructor(thisValue: unknown = undefined) {
        this.#thisValue = thisValue
    }

    get [EventTargetListeners](): EventDescriptor[] | undefined {
        return [...this.#listeners];
    }

    addEventListener(type: string, callback: EventCallback, options?: Record<string, unknown>) {
        const listener: EventListener = {
            ...options,
            isListening: () => !!this.#listeners.find(matchEventCallback(type, callback)),
            descriptor: {
                [EventDescriptorSymbol]: true,
                ...options,
                type,
                callback
            },
            timestamp: Date.now()
        }
        if (listener.isListening()) {
            return
        }
        this.#listeners.push(listener.descriptor)
    }

    removeEventListener(type: string | symbol, callback: Function, options?: unknown) {
        if (!isFunctionEventCallback(callback)) {
            return
        }
        const externalListeners = this[EventTargetListeners] ?? this.#listeners;
        const externalIndex = externalListeners.findIndex(matchEventCallback(type, callback, options));
        if (externalIndex === -1) {
            return;
        }
        const index = this.#listeners.findIndex(matchEventCallback(type, callback, options))
        if (index !== -1) {
            this.#listeners.splice(index, 1);
        }
        const descriptor = externalListeners[externalIndex];
        if (descriptor) {
            this.#ignoreExternalListener.add(descriptor);
        }
    }

    async dispatchEvent(event: Event) {
        const listeners = (this[EventTargetListeners] ?? this.#listeners)
            .filter(descriptor => descriptor.type === event.type || descriptor.type === "*")
            .filter(descriptor => !this.#ignoreExternalListener.has(descriptor));

        // Don't even dispatch an aborted event
        if (isSignalEvent(event) && event.signal.aborted) {
            throw new AbortError();
        }

        const parallel = isParallelEvent(event)
        const promises = []
        for (let index = 0; index < listeners.length; index += 1) {
            const descriptor = listeners[index]

            if (!parallel && !this.#listeners.includes(descriptor)) {
                continue
            }

            const promise = (async () => {
                // Remove the listener before invoking the callback
                // This ensures that inside of the callback causes no more additional event triggers to this
                // listener
                if (descriptor.once) {
                    // by passing the descriptor as the options, we get an internal redirect
                    // that forces an instance level object equals, meaning
                    // we will only remove _this_ descriptor!
                    this.removeEventListener(descriptor.type, descriptor.callback, descriptor);
                }

                await descriptor.callback.call(this.#thisValue, event);
            })();

            if (!parallel) {
                try {
                    await promise
                } catch (error) {
                    if (!isSignalHandled(event, error)) {
                        await Promise.reject(error);
                    }
                }
                if (isSignalEvent(event) && event.signal.aborted) {
                    // bye
                    return
                }
            } else {
                promises.push(promise)
            }
        }
        if (promises.length) {
            // Allows for all promises to settle finish so we can stay within the event, we then
            // will utilise Promise.all which will reject with the first rejected promise
            const results = await Promise.allSettled(promises)

            const rejected = results.filter(
                (result): result is PromiseRejectedResult => {
                    return result.status === "rejected"
                }
            )

            if (rejected.length) {
                let unhandled = rejected

                // If the event was aborted, then allow abort errors to occur, and handle these as handled errors
                // The dispatcher does not care about this because they requested it
                //
                // There may be other unhandled errors that are more pressing to the task they are doing.
                //
                // The dispatcher can throw an abort error if they need to throw it up the chain
                if (isSignalEvent(event) && event.signal.aborted) {
                    unhandled = unhandled.filter(result => !isSignalHandled(event, result.reason))
                }
                if (unhandled.length === 1) {
                    await Promise.reject(unhandled[0].reason);
                    throw unhandled[0]; // We shouldn't get here
                } else if (unhandled.length > 1) {
                    throw new AggregateError(unhandled.map(({ reason }) => reason));
                }
            }
        }

    }

    async hasEventListener(type: string, callback?: Function) {
        if (callback && !isFunctionEventCallback(callback)) {
            return
        }
        const foundIndex = this.#listeners.findIndex(matchEventCallback(type, callback))
        return foundIndex > -1
    }
}

export function isSignalHandled(event: Event, error: unknown) {
    if (isSignalEvent(event) && event.signal.aborted && error instanceof Error && isAbortError(error)) {
        return true
    }
}
