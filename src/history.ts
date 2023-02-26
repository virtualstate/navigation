import { Navigation, NavigationResult } from "./spec/navigation";
import {
  NavigationLocation,
  NavigationLocationOptions,
  AppLocationAwaitFinished,
  AppLocationTransitionURL,
} from "./location";
import { InvalidStateError } from "./navigation-errors";

const State = Symbol.for("@virtualstate/navigation/history/state");

export type ScrollRestoration = "auto" | "manual";

export interface History {}

export interface NavigationHistoryOptions extends NavigationLocationOptions {
  navigation: Navigation;
  [State]?: unknown
}

export interface NavigationHistory<S extends object> {}



/**
 * @experimental
 */
export class NavigationHistory<S extends object>
  extends NavigationLocation
  implements History
{
  readonly #options: NavigationHistoryOptions;
  readonly #navigation: Navigation;

  constructor(options: NavigationHistoryOptions) {
    super(options);
    this.#options = options;
    this.#navigation = options.navigation;
  }

  get length() {
    return this.#navigation.entries().length;
  }

  scrollRestoration: ScrollRestoration = "manual";

  get state(): unknown {
    const currentState = this.#navigation.currentEntry?.getState();
    if (typeof currentState === "string" || typeof currentState === "number" || typeof currentState === "boolean") {
      return currentState;
    }
    return this.#options[State] ?? undefined;
  }

  back(): void {
    const entries = this.#navigation.entries();
    const index = this.#navigation.currentEntry?.index ?? -1;
    const back = entries[index - 1];
    const url = back?.url;
    if (!url) throw new InvalidStateError("Cannot go back");
    this[AppLocationTransitionURL](url, () =>
      this.#navigation.back()
    );
  }

  forward(): void {
    const entries = this.#navigation.entries();
    const index = this.#navigation.currentEntry?.index ?? -1;
    const forward = entries[index + 1];
    const url = forward?.url;
    if (!url) throw new InvalidStateError("Cannot go forward");
    this[AppLocationTransitionURL](url, () =>
      this.#navigation.forward()
    );
  }

  go(delta?: number): void {
    if (typeof delta !== "number" || delta === 0 || isNaN(delta)) {
      this[AppLocationAwaitFinished](this.#navigation.reload());
      return;
    }
    const entries = this.#navigation.entries();
    const {
      currentEntry
    } = this.#navigation;
    if (!currentEntry) {
      throw new Error(`Could not go ${delta}`);
    }
    const nextIndex = currentEntry.index + delta;
    const nextEntry = entries[nextIndex];
    if (!nextEntry) {
      throw new Error(`Could not go ${delta}`);
    }
    const nextEntryKey = nextEntry.key;
    this[AppLocationAwaitFinished](this.#navigation.traverseTo(nextEntryKey));
  }

  replaceState(
    data: any,
    unused: string,
    url?: string | URL | null
  ): void;
  replaceState(data: any, unused: string, url?: string | URL | null): void;
  replaceState(
    data: any,
    unused: string,
    url?: string | URL | null
  ): void {
    if (url) {
      this[AppLocationTransitionURL](url, (url) =>
        this.#navigation.navigate(url.toString(), {
          state: data,
          history: "replace",
        })
      );
      return;
    } else {
      this.#navigation.updateCurrentEntry({
        state: data
      });
      return;
    }
  }

  pushState(
    data: unknown,
    unused: string,
    url?: string | URL | null
  ): void {
    if (url) {
      this[AppLocationTransitionURL](url, (url) =>
        this.#navigation.navigate(url.toString(), {
          state: data,
        })
      );
    } else {
      this.#navigation.updateCurrentEntry({
        state: data,
      });
    }
  }
}

/**
 * @experimental
 * @internal
 */
export class NavigationSync<S extends object>
  extends NavigationHistory<S>
  implements NavigationHistory<S>, NavigationLocation {}
