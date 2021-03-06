import { AsyncEventTarget } from "./async-event-target";

const defaultModule =  { EventTarget: AsyncEventTarget, AsyncEventTarget, SyncEventTarget: AsyncEventTarget } as const;

let module: Record<string, unknown>;

try {
    module = await import("@virtualstate/navigation/event-target");
    console.log("Using @virtualstate/navigation/event-target", module);
} catch {
    console.log("Using default");
    module = defaultModule;
}

const EventTargetImplementation =
    module.EventTarget || module.SyncEventTarget || module.AsyncEventTarget;

function assertEventTarget(target: unknown): asserts target is AsyncEventTarget {
    if (typeof target !== "function") {
        throw new Error("Could not load EventTarget implementation");
    }
}

export class EventTarget extends AsyncEventTarget {

    constructor(...args: unknown[]) {
        super();
        if (EventTargetImplementation) {
            assertEventTarget(EventTargetImplementation);
            const {
                dispatchEvent
            } = new EventTargetImplementation(...args);
            this.dispatchEvent = dispatchEvent;
        }
    }

}