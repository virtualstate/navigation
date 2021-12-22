import {EventCallback, EventTarget, EventTargetAddListenerOptions} from "./event-target";
import {Event} from "./event";

const globalEventTarget = new EventTarget();

export function dispatchEvent(event: Event) {
    return globalEventTarget.dispatchEvent(event);
}

export function addEventListener(type: string, callback: EventCallback, options?: EventTargetAddListenerOptions): void | Promise<void>
export function addEventListener(type: string, callback: Function, options?: EventTargetAddListenerOptions): void | Promise<void>
export function addEventListener(type: string, callback: EventCallback, options?: EventTargetAddListenerOptions): void | Promise<void> {
    return globalEventTarget.addEventListener(type, callback, options);
}

export function removeEventListener(type: string, callback: EventCallback, options?: EventTargetAddListenerOptions): void | Promise<void>
export function removeEventListener(type: string, callback: Function, options?: EventTargetAddListenerOptions): void | Promise<void>
export function removeEventListener(type: string, callback: EventCallback, options?: EventTargetAddListenerOptions): void | Promise<void> {
    return globalEventTarget.removeEventListener(type, callback, options);
}