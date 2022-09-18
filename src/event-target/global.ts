import { EventTarget } from "./event-target";
import { Event } from "./event";
import { FetchEvent } from "../tests/examples/fetch";
import { EventTargetAddListenerOptions } from "./event-target-options";
import { EventCallback } from "./callback";

const globalEventTarget = new EventTarget();

export function dispatchEvent(event: Event) {
  return globalEventTarget.dispatchEvent(event);
}

export function addEventListener(
  type: "fetch",
  callback: EventCallback<FetchEvent>,
  options?: EventTargetAddListenerOptions
): void;
export function addEventListener(
  type: string | symbol,
  callback: EventCallback,
  options?: EventTargetAddListenerOptions
): void;
export function addEventListener(
  type: string | symbol,
  callback: Function,
  options?: EventTargetAddListenerOptions
): void {
  return globalEventTarget.addEventListener(type, callback, options);
}

export function removeEventListener(
  type: string | symbol,
  callback: EventCallback,
  options?: EventTargetAddListenerOptions
): void;
export function removeEventListener(
  type: string | symbol,
  callback: Function,
  options?: EventTargetAddListenerOptions
): void;
export function removeEventListener(
  type: string | symbol,
  callback: Function,
  options?: EventTargetAddListenerOptions
): void {
  return globalEventTarget.removeEventListener(type, callback, options);
}
