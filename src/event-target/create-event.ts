import { assertEvent, Event } from "./event";

export function createEvent<E extends Event>(
  event: E
): E {
  if (typeof CustomEvent !== "undefined" && typeof event.type === "string") {
    if (event instanceof CustomEvent) {
      return event;
    }
    const { type, detail, ...rest } = event;
    const customEvent: unknown = new CustomEvent(type, {
      detail: detail ?? rest,
    });
    Object.assign(customEvent, rest);
    assertEvent<E>(customEvent, event.type);
    return customEvent;
  }
  return event;
}
