import { assertEvent, Event } from "./event";

export function createEvent<T extends string | symbol, E extends Event<T>>(
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
    assertEvent<T, E>(customEvent, event.type);
    return customEvent;
  }
  return event;
}
