import {
  Navigation,
  NavigationHistoryEntry,
  NavigationResult,
} from "./spec/navigation";
import { NavigationTransitionCommittedDeferred } from "./navigation-transition";
import { Deferred } from "./util/deferred";
import { getBaseURL} from "./base-url";

export interface NavigationLocationOptions {
  navigation: Navigation;
  baseURL?: URL | string;
}

type WritableURLKey =
  | "hash"
  | "host"
  | "hostname"
  | "href"
  | "pathname"
  | "port"
  | "protocol"
  | "search";

export const AppLocationCheckChange = Symbol.for(
  "@virtualstate/navigation/location/checkChange"
);
export const AppLocationAwaitFinished = Symbol.for(
  "@virtualstate/navigation/location/awaitFinished"
);
export const AppLocationTransitionURL = Symbol.for(
  "@virtualstate/navigation/location/transitionURL"
);
export const AppLocationUrl = Symbol.for(
  "@virtualstate/navigation/location/url"
);

export interface LocationAncestorOriginsList {
  readonly length: number;
  contains(string: string): boolean;
  item(index: number): string | null;
  [index: number]: string;
}

export interface LocationPrototype {
  readonly ancestorOrigins: LocationAncestorOriginsList;
}

export interface Location extends LocationPrototype {}

export interface NavigationLocation extends Location {}

export const NAVIGATION_LOCATION_DEFAULT_URL = "https://html.spec.whatwg.org/";

/**
 * @experimental
 */
export class NavigationLocation implements Location {
  readonly #options: NavigationLocationOptions;
  readonly #navigation: Navigation;

  constructor(options: NavigationLocationOptions) {
    this.#options = options;
    this.#navigation = options.navigation;

    const reset = () => {
      this.#transitioningURL = undefined;
      this.#baseURL = undefined;
    };

    this.#navigation.addEventListener("navigate", () => {
      const transition = this.#navigation.transition;
      if (transition && isCommittedAvailable(transition)) {
        transition[NavigationTransitionCommittedDeferred].promise.then(
          reset,
          reset
        );
      }
      function isCommittedAvailable(
        transition: object
      ): transition is {
        [NavigationTransitionCommittedDeferred]: Deferred<NavigationHistoryEntry>;
      } {
        return NavigationTransitionCommittedDeferred in transition;
      }
    });

    this.#navigation.addEventListener("currententrychange", reset);
  }

  #urls = new WeakMap<object, URL>();

  #transitioningURL: URL | undefined;

  #baseURL: URL | undefined;

  get [AppLocationUrl]() {
    if (this.#transitioningURL) {
      return this.#transitioningURL;
    }
    const { currentEntry } = this.#navigation;
    if (!currentEntry) {
      this.#baseURL = getBaseURL(this.#options.baseURL);
      return this.#baseURL;
    }
    const existing = this.#urls.get(currentEntry);
    if (existing) return existing;
    const next = new URL(currentEntry.url ?? NAVIGATION_LOCATION_DEFAULT_URL);
    this.#urls.set(currentEntry, next);
    return next;
  }

  get hash() {
    return this[AppLocationUrl].hash;
  }

  set hash(value) {
    this.#setUrlValue("hash", value);
  }

  get host() {
    return this[AppLocationUrl].host;
  }

  set host(value) {
    this.#setUrlValue("host", value);
  }

  get hostname() {
    return this[AppLocationUrl].hostname;
  }

  set hostname(value) {
    this.#setUrlValue("hostname", value);
  }

  get href() {
    return this[AppLocationUrl].href;
  }

  set href(value) {
    this.#setUrlValue("href", value);
  }

  get origin() {
    return this[AppLocationUrl].origin;
  }

  get pathname() {
    return this[AppLocationUrl].pathname;
  }

  set pathname(value) {
    this.#setUrlValue("pathname", value);
  }

  get port() {
    return this[AppLocationUrl].port;
  }

  set port(value) {
    this.#setUrlValue("port", value);
  }

  get protocol() {
    return this[AppLocationUrl].protocol;
  }

  set protocol(value) {
    this.#setUrlValue("protocol", value);
  }

  get search() {
    return this[AppLocationUrl].search;
  }

  set search(value) {
    this.#setUrlValue("search", value);
  }

  #setUrlValue = (key: WritableURLKey, value: string) => {
    const currentUrlString = this[AppLocationUrl].toString();
    let nextUrl: URL;
    if (key === "href") {
      nextUrl = new URL(value, currentUrlString)
    } else {
      nextUrl = new URL(currentUrlString);
      nextUrl[key] = value;
    }
    const nextUrlString = nextUrl.toString();
    if (currentUrlString === nextUrlString) {
      return;
    }
    void this.#transitionURL(nextUrl, () =>
      this.#navigation.navigate(nextUrlString)
    );
  };

  replace(url: string | URL): unknown;
  replace(url: string | URL): void;
  replace(url: string | URL): unknown {
    return this.#transitionURL(url, (url) =>
      this.#navigation.navigate(url.toString(), {
        history: "replace",
      })
    );
  }

  reload(): unknown;
  reload(): void;
  reload(): unknown {
    return this.#awaitFinished(this.#navigation.reload());
  }

  assign(url: string | URL): unknown;
  assign(url: string | URL): void;
  assign(url: string | URL): unknown {
    return this.#transitionURL(url, (url) =>
      this.#navigation.navigate(url.toString())
    );
  }

  protected [AppLocationTransitionURL](
    url: URL | string,
    fn: (url: URL) => NavigationResult
  ) {
    return this.#transitionURL(url, fn);
  }

  #transitionURL = async (
    url: URL | string,
    fn: (url: URL) => NavigationResult
  ) => {
    const instance = (this.#transitioningURL =
      typeof url === "string"
        ? new URL(url, this[AppLocationUrl].toString())
        : url);
    try {
      await this.#awaitFinished(fn(instance));
    } finally {
      if (this.#transitioningURL === instance) {
        this.#transitioningURL = undefined;
      }
    }
  };

  protected [AppLocationAwaitFinished](result: NavigationResult) {
    return this.#awaitFinished(result);
  }

  #awaitFinished = async (result?: NavigationResult) => {
    this.#baseURL = undefined;
    if (!result) return;
    const { committed, finished } = result;
    await Promise.all([
      committed || Promise.resolve(undefined),
      finished || Promise.resolve(undefined),
    ]);
  };

  #triggerIfUrlChanged = () => {
    const current = this[AppLocationUrl];
    const currentUrl = current.toString();
    const expectedUrl = this.#navigation.currentEntry?.url;
    if (currentUrl !== expectedUrl) {
      return this.#transitionURL(current, () =>
        this.#navigation.navigate(currentUrl)
      );
    }
  };

  /**
   * This is needed if you have changed searchParams using its mutating methods
   *
   * TODO replace get searchParams with an observable change to auto trigger this function
   */
  [AppLocationCheckChange]() {
    return this.#triggerIfUrlChanged();
  }
}
