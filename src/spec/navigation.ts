/**
 * This file is derived from https://github.com/WICG/app-history/blob/7c0332b30746b14863f717404402bc49e497a2b2/app_history.d.ts
 *
 * The main changes here is the usage of optional types over null, and support for updateCurrent()?.then;
 *
 * null is still included in places where properties have been marked as optional
 */

import {
  AsyncEventTarget as EventTarget,
  EventCallback,
  Event,
  EventTargetListeners,
  EventDescriptor,
  EventTargetAddListenerOptions,
} from "../event-target";

export interface NavigationEventMap<S = unknown, R = void | unknown> {
  navigate: NavigateEvent<S, R>;
  navigatesuccess: Event;
  navigateerror: Event & { error?: unknown };
  currententrychange: NavigationCurrentEntryChangeEvent<S, R>;
  /**
   * @experimental
   */
  entrieschange: NavigationEntriesChangeEvent<S>;
}

export interface NavigationResult<S = unknown> {
  committed: Promise<NavigationHistoryEntry<S>>;
  finished: Promise<NavigationHistoryEntry<S>>;
}

export interface Navigation<S = unknown, R = unknown | void> extends EventTarget {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly currentEntry?: NavigationHistoryEntry<S> | null;
  readonly transition?: NavigationTransition<S> | null;

  entries(): NavigationHistoryEntry<S>[];
  updateCurrentEntry(options: NavigationUpdateCurrentOptions<S>): unknown;
  updateCurrentEntry(options: NavigationUpdateCurrentOptions<S>): void;

  navigate(
    url: string|URL,
    options?: NavigationNavigateOptions<S>
  ): NavigationResult<S>;
  reload(
    options?: NavigationReloadOptions<S>
  ): NavigationResult<S>;

  traverseTo(key: string, options?: NavigationNavigationOptions): NavigationResult<S>;
  back(options?: NavigationNavigationOptions): NavigationResult<S>;
  forward(options?: NavigationNavigationOptions): NavigationResult<S>;

  onnavigate?:
    | ((this: Navigation, ev: NavigateEvent<S>) => unknown | void)
    | null;
  onnavigatesuccess?: ((this: Navigation, ev: Event) => unknown | void) | null;
  onnavigateerror?:
    | ((this: Navigation, ev: ErrorEvent) => unknown | void)
    | null;
  oncurrententrychange?:
    | ((this: Navigation, ev: NavigationCurrentEntryChangeEvent<S>) => unknown)
    | null;
  /**
   * @experimental
   */
  onentrieschange?: ((this: Navigation, ev: Event) => unknown | void) | null;

  addEventListener<K extends keyof NavigationEventMap<S, R>>(
    type: K,
    listener: (ev: NavigationEventMap<S, R>[K]) => unknown | void,
    options?: boolean | EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventCallback,
    options?: boolean | EventTargetAddListenerOptions
  ): void;
  removeEventListener<K extends keyof NavigationEventMap<S, R>>(
    type: K,
    listener: (ev: NavigationEventMap<S, R>[K]) => unknown,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventCallback,
    options?: boolean | EventListenerOptions
  ): void;
}

export interface NavigationTransitionInit<S = unknown> {
  navigationType: NavigationNavigationType;
  from: NavigationHistoryEntry<S>;
  finished: Promise<NavigationHistoryEntry<S>>;
}

export interface NavigationTransition<S = unknown>
  extends NavigationTransitionInit {
  readonly navigationType: NavigationNavigationType;
  readonly from: NavigationHistoryEntry<S>;
  readonly finished: Promise<NavigationHistoryEntry<S>>;

  rollback(options?: NavigationNavigationOptions): NavigationResult<S>;
}

export interface NavigationHistoryEntryEventMap {
  navigateto: Event;
  navigatefrom: Event;
  finish: Event;
  dispose: Event;
}

export interface NavigationHistoryEntryInit<S = unknown>
  extends NavigationNavigateOptions<S> {
  key?: string;
  url?: string | null;
  index: number | (() => number);
  sameDocument?: boolean;
  [EventTargetListeners]?: EventDescriptor[];
}

export interface NavigationHistoryEntry<S = Record<string, unknown>> extends EventTarget {
  readonly key: string;
  readonly id: string;
  readonly url?: string;
  readonly index: number;
  readonly sameDocument: boolean;

  getState<ST extends S = S>(): ST;

  onnavigateto?: ((ev: Event) => unknown) | null;
  onnavigatefrom?: ((ev: Event) => unknown) | null;
  onfinish?: ((ev: Event) => unknown) | null;
  ondispose?: ((ev: Event) => unknown) | null;

  addEventListener<K extends keyof NavigationHistoryEntryEventMap>(
    type: K,
    listener: EventCallback<NavigationHistoryEntryEventMap[K]>,
    options?: boolean | EventTargetAddListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventCallback,
    options?: boolean | EventTargetAddListenerOptions
  ): void;
  removeEventListener<K extends keyof NavigationHistoryEntryEventMap>(
    type: K,
    listener: EventCallback,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventCallback,
    options?: boolean | EventListenerOptions
  ): void;
}

export type NavigationNavigationType =
  | "reload"
  | "push"
  | "replace"
  | "traverse";

export interface NavigationUpdateCurrentOptions<S = unknown> {
  state: S;
}

export interface NavigationNavigationOptions {
  info?: unknown;
}

export interface NavigationNavigateOptions<S = unknown>
  extends NavigationNavigationOptions {
  state?: S;
  history?: "auto"|"push"|"replace";
}

export interface NavigationReloadOptions<S = unknown>
  extends NavigationNavigationOptions {
  state?: S;
}

export interface NavigationCurrentEntryChangeEventInit<S = unknown>
  extends EventInit {
  navigationType?: NavigationNavigationType;
  from: NavigationHistoryEntry<S>;
  startTime?: number;
}

export interface NavigationInterceptFn<R> {
  (): Promise<R>;
}

/**
 * @deprecated
 */
export type NavigationInterceptCommitManualOption = "manual";

export interface NavigationInterceptOptions<R> {
  handler?: NavigationInterceptFn<R>;
  focusReset?: "after-transition" | "manual";
  scroll?: "after-transition" | "manual";
  commit?: "after-transition" | "immediate" | NavigationInterceptCommitManualOption | string;
}

export type NavigationIntercept<R> = NavigationInterceptFn<R> | NavigationInterceptOptions<R> | Promise<R>;

export interface NavigationCurrentEntryChangeEvent<S = unknown, R = unknown | void>
  extends Event<"currententrychange">,
    NavigationCurrentEntryChangeEventInit<S> {
  readonly navigationType?: NavigationNavigationType;
  readonly from: NavigationHistoryEntry<S>;
}

export interface NavigateEvent<S = unknown, R = unknown | void> extends Event<"navigate"> {
  preventDefault(): void;

  readonly navigationType: NavigationNavigationType;
  readonly canIntercept: boolean;
  readonly userInitiated: boolean;
  readonly hashChange: boolean;
  readonly destination: NavigationDestination<S>;
  readonly signal: AbortSignal;
  readonly formData?: FormData;
  readonly downloadRequest?: string;
  readonly info: unknown;

  intercept(options?: NavigationIntercept<R>): void;
  scroll(): void;

  /**
   * @deprecated use intercept
   */
  transitionWhile?(options?: NavigationIntercept<R>): void;

  commit(): void;

  /**
   * @experimental not part of spec yet
   */
  reportError?(reason: unknown): void;
}

export interface NavigateEventInit<S = unknown> extends EventInit {
  navigationType?: NavigationNavigationType;
  canIntercept?: boolean;
  userInitiated?: boolean;
  hashChange?: boolean;
  destination: NavigationDestination<S>;
  signal: AbortSignal;
  formData?: FormData;
  downloadRequest?: string;
  info?: unknown;
}

export interface NavigationDestination<S = unknown> {
  readonly url: string;
  readonly key?: string;
  readonly id?: string;
  readonly index: number;
  readonly sameDocument: boolean;
  getState<GS extends S = S>(): GS;
  getState(): S;
}

export interface NavigationEntriesChangeEventInit<S> {
  addedEntries: NavigationHistoryEntry<S>[]
  removedEntries: NavigationHistoryEntry<S>[]
  updatedEntries: NavigationHistoryEntry<S>[]
}

export interface NavigationEntriesChangeEvent<S = unknown>
    extends Event<"entrieschange">,
        NavigationEntriesChangeEventInit<S> {
}
