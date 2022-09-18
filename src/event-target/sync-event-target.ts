import { Event } from "./event";
import { isSignalEvent, isSignalHandled } from "./signal-event";
import { AbortError } from "../navigation-errors";
import {
  EventTargetListenersMatch,
  EventTargetListenersThis,
} from "./event-target-options";
import { EventTargetListeners } from "./event-target-listeners";

export interface SyncEventTarget extends EventTargetListeners {
  new (thisValue?: unknown): SyncEventTarget;
  dispatchEvent(event: Event): void | Promise<void>;
}

export class SyncEventTarget
  extends EventTargetListeners
  implements SyncEventTarget
{
  readonly [EventTargetListenersThis]: unknown;

  constructor(thisValue: unknown = undefined) {
    super();
    this[EventTargetListenersThis] = thisValue;
  }

  dispatchEvent(event: Event) {
    const listeners = this[EventTargetListenersMatch]?.(event.type) ?? [];

    // Don't even dispatch an aborted event
    if (isSignalEvent(event) && event.signal.aborted) {
      throw new AbortError();
    }

    for (let index = 0; index < listeners.length; index += 1) {
      const descriptor = listeners[index];

      // Remove the listener before invoking the callback
      // This ensures that inside of the callback causes no more additional event triggers to this
      // listener
      if (descriptor.once) {
        // by passing the descriptor as the options, we get an internal redirect
        // that forces an instance level object equals, meaning
        // we will only remove _this_ descriptor!
        this.removeEventListener(
          descriptor.type,
          descriptor.callback,
          descriptor
        );
      }

      try {
        descriptor.callback.call(this[EventTargetListenersThis] ?? this, event);
      } catch (error) {
        if (!isSignalHandled(event, error)) {
          throw error;
        }
      }
      if (isSignalEvent(event) && event.signal.aborted) {
        throw new AbortError();
      }
    }
  }
}
