import { AsyncEventTarget } from "./async-event-target";

const defaultEventTargetModule = {
  EventTarget: AsyncEventTarget,
  AsyncEventTarget,
  SyncEventTarget: AsyncEventTarget,
} as const;

let eventTargetModule: Record<string, unknown> = defaultEventTargetModule;
//
// try {
//     eventTargetModule = await import("@virtualstate/navigation/event-target");
//     console.log("Using @virtualstate/navigation/event-target", eventTargetModule);
// } catch {
//     console.log("Using defaultEventTargetModule");
//     eventTargetModule = defaultEventTargetModule;
// }

const EventTargetImplementation =
    eventTargetModule.EventTarget || eventTargetModule.SyncEventTarget || eventTargetModule.AsyncEventTarget;

function assertEventTarget(
  target: unknown
): asserts target is AsyncEventTarget {
  if (typeof target !== "function") {
    throw new Error("Could not load EventTarget implementation");
  }
}

export class EventTarget extends AsyncEventTarget {
  constructor(...args: unknown[]) {
    super();
    if (EventTargetImplementation) {
      assertEventTarget(EventTargetImplementation);
      const { dispatchEvent } = new EventTargetImplementation(...args);
      this.dispatchEvent = dispatchEvent;
    }
  }
}
