import { Event } from "./event";
import { EventCallback } from "./callback";
import { isParallelEvent } from "./parallel-event";
import { isSignalEvent, isSignalHandled } from "./signal-event";
import { AbortError } from "../navigation-errors";
import {
  EventTargetAddListenerOptions,
  EventTargetListenersMatch,
  EventTargetListenersThis,
} from "./event-target-options";
import { EventTargetListeners } from "./event-target-listeners";

export type { EventCallback, EventTargetAddListenerOptions };

export interface AsyncEventTarget extends EventTargetListeners {
  new (thisValue?: unknown): AsyncEventTarget;
  dispatchEvent(event: Event): void | Promise<void>;
}

export class AsyncEventTarget
  extends EventTargetListeners
  implements AsyncEventTarget
{
  readonly [EventTargetListenersThis]?: unknown;

  constructor(thisValue: unknown = undefined) {
    super();
    this[EventTargetListenersThis] = thisValue;
  }

  async dispatchEvent(event: Event) {
    const listeners = this[EventTargetListenersMatch]?.(event.type) ?? [];

    // Don't even dispatch an aborted event
    if (isSignalEvent(event) && event.signal.aborted) {
      throw new AbortError();
    }

    const parallel = isParallelEvent(event);
    const promises = [];
    for (let index = 0; index < listeners.length; index += 1) {
      const descriptor = listeners[index];

      const promise = (async () => {
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

        await descriptor.callback.call(
          this[EventTargetListenersThis] ?? this,
          event
        );
      })();

      if (!parallel) {
        try {
          await promise;
        } catch (error) {
          if (!isSignalHandled(event, error)) {
            await Promise.reject(error);
          }
        }
        if (isSignalEvent(event) && event.signal.aborted) {
          // bye
          return;
        }
      } else {
        promises.push(promise);
      }
    }
    if (promises.length) {
      // Allows for all promises to settle finish so we can stay within the event, we then
      // will utilise Promise.all which will reject with the first rejected promise
      const results = await Promise.allSettled(promises);

      const rejected = results.filter(
        (result): result is PromiseRejectedResult => {
          return result.status === "rejected";
        }
      );

      if (rejected.length) {
        let unhandled = rejected;

        // If the event was aborted, then allow abort errors to occur, and handle these as handled errors
        // The dispatcher does not care about this because they requested it
        //
        // There may be other unhandled errors that are more pressing to the task they are doing.
        //
        // The dispatcher can throw an abort error if they need to throw it up the chain
        if (isSignalEvent(event) && event.signal.aborted) {
          unhandled = unhandled.filter(
            (result) => !isSignalHandled(event, result.reason)
          );
        }
        if (unhandled.length === 1) {
          await Promise.reject(unhandled[0].reason);
          throw unhandled[0].reason; // We shouldn't get here
        } else if (unhandled.length > 1) {
          throw new AggregateError(unhandled.map(({ reason }) => reason));
        }
      }
    }
  }
}
