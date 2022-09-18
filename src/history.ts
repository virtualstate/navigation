import { Navigation, NavigationResult } from "./spec/navigation";
import {
  NavigationLocation,
  NavigationLocationOptions,
  AppLocationAwaitFinished,
  AppLocationTransitionURL,
} from "./location";
import { InvalidStateError } from "./navigation-errors";

export interface NavigationHistoryOptions extends NavigationLocationOptions {
  navigation: Navigation;
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

  get state(): S {
    return this.#navigation.currentEntry.getState<S>();
  }

  back(): Promise<void>;
  back(): void;
  async back(): Promise<void> {
    const entries = this.#navigation.entries();
    const index = this.#navigation.currentEntry?.index ?? -1;
    const back = entries[index - 1];
    if (!back) throw new InvalidStateError("Cannot go back");
    return this[AppLocationTransitionURL](back.url, () =>
      this.#navigation.back()
    );
  }

  forward(): Promise<void>;
  forward(): void;
  async forward(): Promise<void> {
    const entries = this.#navigation.entries();
    const index = this.#navigation.currentEntry?.index ?? -1;
    const forward = entries[index + 1];
    if (!forward) throw new InvalidStateError("Cannot go forward");
    return this[AppLocationTransitionURL](forward.url, () =>
      this.#navigation.forward()
    );
  }

  go(delta?: number): Promise<void>;
  go(delta?: number): void;
  async go(delta?: number): Promise<void> {
    if (typeof delta !== "number" || delta === 0 || isNaN(delta)) {
      return this[AppLocationAwaitFinished](this.#navigation.reload());
    }
    const entries = this.#navigation.entries();
    const {
      currentEntry: { index },
    } = this.#navigation;
    const nextIndex = index + delta;
    const nextEntry = entries[nextIndex];
    if (!nextEntry) {
      throw new Error(`Could not go ${delta}`);
    }
    const nextEntryKey = nextEntry.key;
    return this[AppLocationAwaitFinished](this.#navigation.goTo(nextEntryKey));
  }

  replaceState(
    data: any,
    unused: string,
    url?: string | URL | null
  ): Promise<void>;
  replaceState(data: any, unused: string, url?: string | URL | null): void;
  async replaceState(
    data: any,
    unused: string,
    url?: string | URL | null
  ): Promise<void> {
    if (url) {
      return this[AppLocationTransitionURL](url, (url) =>
        this.#navigation.navigate(url.toString(), {
          state: data,
          replace: true,
        })
      );
    } else {
      return this.#navigation.updateCurrentEntry({
        state: data,
      });
    }
  }

  pushState(
    data: object,
    unused: string,
    url?: string | URL | null
  ): Promise<void>;
  pushState(data: unknown, unused: string, url?: string | URL): Promise<void>;
  pushState(data: object, unused: string, url?: string | URL | null): void;
  pushState(data: unknown, unused: string, url?: string | URL): void;
  async pushState(
    data: object,
    unused: string,
    url?: string | URL | null
  ): Promise<void> {
    if (url) {
      return this[AppLocationTransitionURL](url, (url) =>
        this.#navigation.navigate(url.toString(), {
          state: data,
        })
      );
    } else {
      return this.#navigation.updateCurrentEntry({
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
