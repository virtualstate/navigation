import { Event } from "./event"
import { EventListener } from "./context"
import { EventCallback, SyncEventCallback } from "./callback"
import { EventDescriptor, EventDescriptorSymbol } from "./descriptor"
import { matchEventCallback } from "./callback"
import { isSignalEvent } from "./signal-event"
import { isAbortError } from "../app-history-errors"
import {
    EventTargetAddListenerOptions,
    EventTargetListeners as EventTargetListenersSymbol,
    EventTargetListenersIgnore, EventTargetListenersMatch
} from "./event-target-options";

export interface ExternalSyncEventTargetListeners<Event = unknown> {
    addEventListener(type: string, callback: SyncEventCallback<Event>, options?: EventTargetAddListenerOptions): void
    removeEventListener(type: string, callback: SyncEventCallback<Event>, options?: unknown): void
}

export interface EventTargetListeners extends ExternalSyncEventTargetListeners<Event> {
    addEventListener(type: string | symbol, callback: EventCallback, options?: EventTargetAddListenerOptions): void
    addEventListener(type: string | symbol, callback: Function, options?: EventTargetAddListenerOptions): void
    removeEventListener(type: string | symbol, callback: Function, options?: unknown): void
    hasEventListener(type: string | symbol, callback?: Function): boolean;
}

function isFunctionEventCallback(fn: Function): fn is EventCallback {
    return typeof fn === "function"
}

export class EventTargetListeners implements EventTargetListeners {

    #listeners: EventDescriptor[] = [];
    [EventTargetListenersIgnore] = new WeakSet<EventDescriptor>();

    get [EventTargetListenersSymbol](): EventDescriptor[] | undefined {
        return [...this.#listeners];
    }

    [EventTargetListenersMatch](type: string | symbol) {
        const external = this[EventTargetListenersSymbol];
        return [
            ...new Set([...(external ?? []), ...this.#listeners])
        ]
            .filter(descriptor => descriptor.type === type || descriptor.type === "*")
            .filter(descriptor => !this[EventTargetListenersIgnore].has(descriptor));
    }

    addEventListener(type: string | symbol, callback: EventCallback, options?: EventTargetAddListenerOptions): void
    addEventListener(type: string | symbol, callback: Function, options?: EventTargetAddListenerOptions): void
    addEventListener(type: string, callback: EventCallback, options?: EventTargetAddListenerOptions) {
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

    removeEventListener(type: string | symbol, callback: Function, options?: unknown): void
    removeEventListener(type: string | symbol, callback: Function, options?: unknown) {
        if (!isFunctionEventCallback(callback)) {
            return
        }
        const externalListeners = this[EventTargetListenersSymbol] ?? this.#listeners;
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
            this[EventTargetListenersIgnore].add(descriptor);
        }
    }

    hasEventListener(type: string | symbol, callback?: Function): boolean;
    hasEventListener(type: string, callback?: Function): boolean {
        if (callback && !isFunctionEventCallback(callback)) {
            return false;
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