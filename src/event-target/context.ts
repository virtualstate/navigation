import { Event } from "./event";
import { EventDescriptor } from "./descriptor";

export interface DispatchedEvent {
  descriptor?: EventDescriptor;
  event: Event;
  target: unknown;
  timestamp: number;
}

export interface EventListener {
  isListening(): boolean;
  descriptor: EventDescriptor;
  timestamp: number;
}
