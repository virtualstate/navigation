import { EventCallback } from "./callback";

export const EventDescriptorSymbol = Symbol.for(
  "@opennetwork/environment/events/descriptor"
);

export interface EventDescriptor {
  [EventDescriptorSymbol]: true;
  type: string | symbol;
  callback: EventCallback;
  once?: boolean;
}
