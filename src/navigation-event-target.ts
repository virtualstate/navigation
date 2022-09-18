import {
  Event,
  EventCallback,
  EventTarget,
  EventTargetAddListenerOptions,
} from "./event-target";

export class NavigationEventTarget<T> extends EventTarget {
  addEventListener<K extends keyof T>(
    type: K,
    listener: EventCallback<T[K] extends Event ? T[K] : never>,
    options?: boolean | EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string | symbol,
    listener: EventCallback,
    options?: boolean | EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string | symbol,
    listener: Function | EventCallback,
    options?: boolean | EventTargetAddListenerOptions
  ): void {
    assertEventCallback(listener);
    return super.addEventListener(
      type,
      listener,
      typeof options === "boolean" ? { once: options } : options
    );
    function assertEventCallback(
      listener: unknown
    ): asserts listener is EventCallback {
      if (typeof listener !== "function")
        throw new Error("Please us the function variant of event listener");
    }
  }

  removeEventListener(
    type: string | symbol,
    listener: EventCallback,
    options?: unknown
  ): void;
  removeEventListener(
    type: string | symbol,
    callback: Function,
    options?: unknown
  ): void;
  removeEventListener(
    type: string | symbol,
    listener: Function | EventCallback,
    options?: boolean | EventTargetAddListenerOptions
  ): void {
    assertEventCallback(listener);
    return super.removeEventListener(type, listener);
    function assertEventCallback(
      listener: unknown
    ): asserts listener is EventCallback {
      if (typeof listener !== "function")
        throw new Error("Please us the function variant of event listener");
    }
  }
}
