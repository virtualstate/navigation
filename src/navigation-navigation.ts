import {
  Navigation,
  NavigationHistoryEntry,
  NavigationEventMap,
  NavigationNavigationOptions,
  NavigationReloadOptions,
  NavigationResult,
  NavigationUpdateCurrentOptions,
} from "./spec/navigation";
import {
  EventCallback,
  EventTargetAddListenerOptions,
  SyncEventCallback,
  Event,
  EventTargetListeners as EventTargetListenersSymbol,
  EventDescriptor,
} from "./event-target";
import { NavigationNavigateOptions } from "./create-navigation-transition";

export interface NavigationNavigation {
  new (thisValue: Navigation): NavigationNavigation;
}

export class NavigationNavigation<S = unknown> implements Navigation<S> {
  [key: string]: unknown;

  readonly #navigation: Navigation;

  get [EventTargetListenersSymbol](): EventDescriptor[] | undefined {
    return this.#navigation[EventTargetListenersSymbol];
  }

  constructor(Navigation: Navigation<S>) {
    this.#navigation = Navigation;
  }

  get canGoBack() {
    return this.#navigation.canGoBack;
  }

  get canGoForward() {
    return this.#navigation.canGoForward;
  }

  get currentEntry() {
    return this.#navigation.currentEntry;
  }

  set oncurrentchange(value: Navigation["oncurrentchange"]) {
    this.#navigation.oncurrentchange = value;
  }
  set onnavigate(value: Navigation["onnavigate"]) {
    this.#navigation.onnavigate = value;
  }
  set onnavigateerror(value: Navigation["onnavigateerror"]) {
    this.#navigation.onnavigateerror = value;
  }
  set onnavigatesuccess(value: Navigation["onnavigatesuccess"]) {
    this.#navigation.onnavigatesuccess = value;
  }
  get transition() {
    return this.#navigation.transition;
  }

  addEventListener<K extends keyof NavigationEventMap>(
    type: K,
    listener: (ev: NavigationEventMap[K]) => unknown,
    options?: boolean | EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventCallback,
    options?: boolean | EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string | symbol,
    callback: EventCallback,
    options?: EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string,
    callback: EventCallback,
    options?: EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string | symbol,
    callback: Function,
    options?: EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string | symbol,
    listener: EventCallback,
    options?: boolean | EventTargetAddListenerOptions
  ): void {
    if (typeof type === "string") {
      this.#navigation.addEventListener(
        type,
        listener,
        typeof options === "boolean" ? { once: true } : options
      );
    }
  }

  back(options?: NavigationNavigationOptions): NavigationResult {
    return this.#navigation.back(options);
  }

  dispatchEvent(event: Event): Promise<void>;
  dispatchEvent(event: Event): void;
  dispatchEvent(event: Event): void | Promise<void> {
    return this.#navigation.dispatchEvent(event);
  }

  entries(): NavigationHistoryEntry[] {
    return this.#navigation.entries();
  }

  forward(options?: NavigationNavigationOptions): NavigationResult {
    return this.#navigation.forward(options);
  }

  goTo(key: string, options?: NavigationNavigationOptions): NavigationResult {
    return this.#navigation.goTo(key, options);
  }

  hasEventListener(type: string | symbol, callback?: Function): boolean;
  hasEventListener(type: string, callback?: Function): boolean;
  hasEventListener(type: string | symbol, callback?: Function): boolean {
    return this.#navigation.hasEventListener(type, callback);
  }

  navigate(url: string, options?: NavigationNavigateOptions): NavigationResult {
    return this.#navigation.navigate(url, options);
  }

  reload(options?: NavigationReloadOptions): NavigationResult {
    return this.#navigation.reload(options);
  }

  removeEventListener<K extends keyof NavigationEventMap>(
    type: K,
    listener: (ev: NavigationEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventCallback,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string | symbol,
    callback: Function,
    options?: unknown
  ): void;
  removeEventListener(
    type: string,
    callback: SyncEventCallback<Event>,
    options?: unknown
  ): void;
  removeEventListener(
    type: string | symbol,
    listener: EventCallback,
    options?: unknown
  ): void {
    if (typeof type === "string") {
      return this.#navigation.removeEventListener(type, listener, options);
    }
  }

  updateCurrentEntry(options: NavigationUpdateCurrentOptions): Promise<void>;
  updateCurrentEntry(options: NavigationUpdateCurrentOptions): void;
  updateCurrentEntry(
    options: NavigationUpdateCurrentOptions
  ): Promise<void> | void {
    return this.#navigation.updateCurrentEntry(options);
  }
}
