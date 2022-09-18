import { Event, isEvent } from "./event";

export interface ParallelEvent<Name extends string | symbol = string>
  extends Event<Name> {
  parallel: true | undefined;
}

export function isParallelEvent(value: object): value is ParallelEvent {
  return isEvent(value) && value.parallel !== false;
}
