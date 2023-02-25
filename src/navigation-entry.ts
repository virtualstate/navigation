import {
  NavigationHistoryEntry as NavigationHistoryEntryPrototype,
  NavigationHistoryEntryEventMap,
  NavigationHistoryEntryInit as NavigationHistoryEntryInitPrototype,
  NavigationNavigationType,
} from "./spec/navigation";
import { NavigationEventTarget } from "./navigation-event-target";
import { EventTargetListeners } from "./event-target";
import { v4 } from "./util/uuid-or-random";
import * as StructuredJSON from './util/structured-json';
import { getState as getHistoryState, __nav__ } from "./get-navigation";

export const NavigationHistoryEntryNavigationType = Symbol.for(
  "@virtualstate/navigation/entry/navigationType"
);
export const NavigationHistoryEntryKnownAs = Symbol.for(
  "@virtualstate/navigation/entry/knownAs"
);
export const NavigationHistoryEntrySetState = Symbol.for(
  "@virtualstate/navigation/entry/setState"
);

export interface NavigationHistoryEntryInit<S = unknown>
  extends NavigationHistoryEntryInitPrototype<S> {
  navigationType: NavigationNavigationType;
  [NavigationHistoryEntryKnownAs]?: Set<string>;
}

export class NavigationHistoryEntry<S = unknown>
  extends NavigationEventTarget<NavigationHistoryEntryEventMap>
  implements NavigationHistoryEntryPrototype<S>
{
  readonly #index: number | (() => number);
  #state: S | undefined;

  get index() {
    return typeof this.#index === "number" ? this.#index : this.#index();
  }

  public readonly key: string;
  public readonly id: string;
  public readonly url?: string;
  public readonly sameDocument: boolean;

  get [NavigationHistoryEntryNavigationType]() {
    return this.#options.navigationType;
  }

  get [NavigationHistoryEntryKnownAs]() {
    const set = new Set(this.#options[NavigationHistoryEntryKnownAs]);
    set.add(this.id);
    return set;
  }

  #options: NavigationHistoryEntryInit<S>;

  get [EventTargetListeners]() {
    return [
      ...(super[EventTargetListeners] ?? []),
      ...(this.#options[EventTargetListeners] ?? []),
    ];
  }

  constructor(init: NavigationHistoryEntryInit<S>) {
    super();
    this.#options = init;
    this.key = init.key || v4();
    this.id = v4();
    this.url = init.url ?? undefined;
    this.#index = init.index;
    this.sameDocument = init.sameDocument ?? true;
    this.#state = init.state ?? undefined;
  }

  getState<ST extends S>(): ST;
  getState(): S;
  getState(): unknown {
    let state = this.#state;
    
    if (!state && getHistoryState) {
      const hState = getHistoryState();
      if (hState?.[__nav__]?.key === this.key) {
        state = this.#state = hState.state;
      }
      if (!state && typeof sessionStorage !== "undefined") {
        const raw = sessionStorage.getItem(this.id);
        if (raw != null) {
          state = this.#state = StructuredJSON.parse(raw);
        }
      }
    }

    /**
     * https://github.com/WICG/app-history/blob/7c0332b30746b14863f717404402bc49e497a2b2/spec.bs#L1406
     * Note that in general, unless the state value is a primitive, entry.getState() !== entry.getState(), since a fresh copy is returned each time.
     */
    if (
      typeof state === "undefined" ||
      typeof state === "number" ||
      typeof state === "boolean" ||
      typeof state === "symbol" ||
      typeof state === "bigint" ||
      typeof state === "string"
    ) {
      return state;
    }
    if (typeof state === "function") {
      console.warn(
        "State passed to Navigation.navigate was a function, this may be unintentional"
      );
      console.warn(
        "Unless a state value is primitive, with a standard implementation of Navigation"
      );
      console.warn(
        "your state value will be serialized and deserialized before this point, meaning"
      );
      console.warn("a function would not be usable.");
    }
    return {
      ...state,
    };
  }

  [NavigationHistoryEntrySetState](state: S) {
    this.#state = state;
  }
}
