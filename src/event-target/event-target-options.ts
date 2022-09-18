export interface EventTargetAddListenerOptions {
  once?: boolean;
}

/**
 * @experimental
 */
export const EventTargetListeners = Symbol.for(
  "@opennetwork/environment/events/target/listeners"
);

/**
 * @experimental
 */
export const EventTargetListenersIgnore = Symbol.for(
  "@opennetwork/environment/events/target/listeners/ignore"
);

/**
 * @experimental
 */
export const EventTargetListenersMatch = Symbol.for(
  "@opennetwork/environment/events/target/listeners/match"
);

/**
 * @experimental
 */
export const EventTargetListenersThis = Symbol.for(
  "@opennetwork/environment/events/target/listeners/this"
);
