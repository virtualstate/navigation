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

const Navigation = Symbol.for("@virtualstate/navigation/instance");

export class NavigationNavigation<S = unknown> implements Navigation<S> {
  [key: string]: unknown;

  readonly [Navigation]: Navigation;

  get [EventTargetListenersSymbol](): EventDescriptor[] | undefined {
    return this[Navigation][EventTargetListenersSymbol];
  }

  constructor(navigation: Navigation<S>) {
    this[Navigation] = navigation;
  }

  get canGoBack() {
    return this[Navigation].canGoBack;
  }

  get canGoForward() {
    return this[Navigation].canGoForward;
  }

  get currentEntry() {
    return this[Navigation].currentEntry;
  }

  set oncurrentchange(value: Navigation["oncurrentchange"]) {
    this[Navigation].oncurrentchange = value;
  }
  set onnavigate(value: Navigation["onnavigate"]) {
    this[Navigation].onnavigate = value;
  }
  set onnavigateerror(value: Navigation["onnavigateerror"]) {
    this[Navigation].onnavigateerror = value;
  }
  set onnavigatesuccess(value: Navigation["onnavigatesuccess"]) {
    this[Navigation].onnavigatesuccess = value;
  }
  get transition() {
    return this[Navigation].transition;
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
      this[Navigation].addEventListener(
        type,
        listener,
        typeof options === "boolean" ? { once: true } : options
      );
    }
  }

  back(options?: NavigationNavigationOptions): NavigationResult {
    return this[Navigation].back(options);
  }

  dispatchEvent(event: Event): Promise<void>;
  dispatchEvent(event: Event): void;
  dispatchEvent(event: Event): void | Promise<void> {
    return this[Navigation].dispatchEvent(event);
  }

  entries(): NavigationHistoryEntry[] {
    return this[Navigation].entries();
  }

  forward(options?: NavigationNavigationOptions): NavigationResult {
    return this[Navigation].forward(options);
  }

  goTo(key: string, options?: NavigationNavigationOptions): NavigationResult {
    return this[Navigation].goTo(key, options);
  }

  hasEventListener(type: string | symbol, callback?: Function): boolean;
  hasEventListener(type: string, callback?: Function): boolean;
  hasEventListener(type: string | symbol, callback?: Function): boolean {
    return this[Navigation].hasEventListener(type, callback);
  }

  navigate(url: string, options?: NavigationNavigateOptions): NavigationResult {
    return this[Navigation].navigate(url, options);
  }

  reload(options?: NavigationReloadOptions): NavigationResult {
    return this[Navigation].reload(options);
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
      return this[Navigation].removeEventListener(type, listener, options);
    }
  }

  updateCurrentEntry(options: NavigationUpdateCurrentOptions): Promise<void>;
  updateCurrentEntry(options: NavigationUpdateCurrentOptions): void;
  updateCurrentEntry(
    options: NavigationUpdateCurrentOptions
  ): Promise<void> | void {
    return this[Navigation].updateCurrentEntry(options);
  }
}
