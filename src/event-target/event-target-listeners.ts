import { Event } from "./event";
import { EventListener } from "./context";
import { EventCallback, SyncEventCallback } from "./callback";
import { EventDescriptor, EventDescriptorSymbol } from "./descriptor";
import { matchEventCallback } from "./callback";
import { isSignalEvent } from "./signal-event";
import { isAbortError } from "../navigation-errors";
import {
  EventTargetAddListenerOptions,
  EventTargetListeners as EventTargetListenersSymbol,
  EventTargetListenersIgnore,
  EventTargetListenersMatch,
} from "./event-target-options";

export interface ExternalSyncEventTargetListeners<Event = unknown> {
  addEventListener(
    type: string,
    callback: SyncEventCallback<Event>,
    options?: EventTargetAddListenerOptions
  ): void;
  removeEventListener(
    type: string,
    callback: SyncEventCallback<Event>,
    options?: unknown
  ): void;
}

export interface EventTargetListeners
  extends ExternalSyncEventTargetListeners<Event> {
  addEventListener(
    type: string | symbol,
    callback: EventCallback,
    options?: EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string | symbol,
    callback: Function,
    options?: EventTargetAddListenerOptions
  ): void;
  removeEventListener(
    type: string | symbol,
    callback: Function,
    options?: unknown
  ): void;
  hasEventListener(type: string | symbol, callback?: Function): boolean;
}

function isFunctionEventCallback(fn: Function): fn is EventCallback {
  return typeof fn === "function";
}

const EventTargetDescriptors = Symbol.for("@virtualstate/navigation/event-target/descriptors");

export class EventTargetListeners implements EventTargetListeners {
  [key: string]: unknown;

  [EventTargetDescriptors]?: EventDescriptor[] = [];
  [EventTargetListenersIgnore]?: WeakSet<EventDescriptor> =
    new WeakSet<EventDescriptor>();

  get [EventTargetListenersSymbol](): EventDescriptor[] | undefined {
    return [...(this[EventTargetDescriptors] ?? [])];
  }

  [EventTargetListenersMatch]?(type: string | symbol) {
    const external = this[EventTargetListenersSymbol];
    const matched = [
      ...new Set([...(external ?? []), ...(this[EventTargetDescriptors] ?? [])]),
    ]
      .filter(
        (descriptor) => descriptor.type === type || descriptor.type === "*"
      )
      .filter(
        (descriptor) => !this[EventTargetListenersIgnore]?.has(descriptor)
      );

    const listener: unknown =
      typeof type === "string" ? this[`on${type}`] : undefined;

    if (typeof listener === "function" && isFunctionEventCallback(listener)) {
      matched.push({
        type,
        callback: listener,
        [EventDescriptorSymbol]: true,
      });
    }

    return matched;
  }

  addEventListener(
    type: string | symbol,
    callback: EventCallback,
    options?: EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string | symbol,
    callback: Function,
    options?: EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string,
    callback: EventCallback,
    options?: EventTargetAddListenerOptions
  ) {
    const listener: EventListener = {
      ...options,
      isListening: () =>
        !!this[EventTargetDescriptors]?.find(matchEventCallback(type, callback)),
      descriptor: {
        [EventDescriptorSymbol]: true,
        ...options,
        type,
        callback,
      },
      timestamp: Date.now(),
    };
    if (listener.isListening()) {
      return;
    }
    this[EventTargetDescriptors]?.push(listener.descriptor);
  }

  removeEventListener(
    type: string | symbol,
    callback: Function,
    options?: unknown
  ): void;
  removeEventListener(
    type: string | symbol,
    callback: Function,
    options?: unknown
  ) {
    if (!isFunctionEventCallback(callback)) {
      return;
    }
    const externalListeners =
      this[EventTargetListenersSymbol] ?? this[EventTargetDescriptors]?? [];
    const externalIndex = externalListeners.findIndex(
      matchEventCallback(type, callback, options)
    );
    if (externalIndex === -1) {
      return;
    }
    const index =
      this[EventTargetDescriptors]?.findIndex(matchEventCallback(type, callback, options)) ??
      -1;
    if (index !== -1) {
      this[EventTargetDescriptors]?.splice(index, 1);
    }
    const descriptor = externalListeners[externalIndex];
    if (descriptor) {
      this[EventTargetListenersIgnore]?.add(descriptor);
    }
  }

  hasEventListener(type: string | symbol, callback?: Function): boolean;
  hasEventListener(type: string, callback?: Function): boolean {
    if (callback && !isFunctionEventCallback(callback)) {
      return false;
    }
    const foundIndex =
      this[EventTargetDescriptors]?.findIndex(matchEventCallback(type, callback)) ?? -1;
    return foundIndex > -1;
  }
}

export function isSignalHandled(event: Event, error: unknown) {
  if (
    isSignalEvent(event) &&
    event.signal.aborted &&
    error instanceof Error &&
    isAbortError(error)
  ) {
    return true;
  }
}
