import {Event, EventCallback, EventTarget, EventTargetAddListenerOptions} from "@opennetwork/environment";

export class AppHistoryEventTarget<T> extends EventTarget {

    addEventListener<K extends keyof T, This>(this: This, type: K, listener: (this: This, ev: T[K] extends Event ? T[K] : never) => unknown, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventTargetAddListenerOptions): void;
    addEventListener(type: string, listener: Function | EventListenerOrEventListenerObject, options?: boolean | EventTargetAddListenerOptions): void {
        assertEventCallback(listener);
        return super.addEventListener(type, listener, typeof options === "boolean" ? { once: options } : options);
        function assertEventCallback(listener: unknown): asserts listener is EventCallback {
            if (typeof listener !== "function") throw new Error("Please us the function variant of event listener");
        }
    }

    removeEventListener(type: string, listener: (...args: unknown[]) => unknown, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: Function | EventListenerOrEventListenerObject): void {
        assertEventCallback(listener);
        return super.removeEventListener(type, listener);
        function assertEventCallback(listener: unknown): asserts listener is EventCallback {
            if (typeof listener !== "function") throw new Error("Please us the function variant of event listener");
        }
    }
}