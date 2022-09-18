/**
 * This file is derived from https://github.com/WICG/app-history/blob/7c0332b30746b14863f717404402bc49e497a2b2/app_history.d.ts
 *
 * The main changes here is the usage of optional types over null, and support for updateCurrent()?.then;
 *
 * null is still included in places where properties have been marked as optional
 */

import {AsyncEventTarget as EventTarget, EventCallback, Event, EventTargetListeners, EventDescriptor, EventTargetAddListenerOptions} from "../event-target";

export interface NavigationEventMap<S = unknown> {
    "navigate": NavigateEvent<S>;
    "navigatesuccess": Event;
    "navigateerror": Event & { error?: unknown };
    "currentchange": NavigationCurrentEntryChangeEvent<S>;
}

export interface NavigationResult<S = unknown> {
    committed: Promise<NavigationHistoryEntry<S>>;
    finished: Promise<NavigationHistoryEntry<S>>;
}

export interface Navigation<S = unknown> extends EventTarget {

    readonly canGoBack: boolean;
    readonly canGoForward: boolean;
    readonly currentEntry?: NavigationHistoryEntry<S> | null;
    readonly transition?: NavigationTransition<S> | null;

    entries(): NavigationHistoryEntry<S>[];
    updateCurrentEntry(options: NavigationUpdateCurrentOptions<S>): Promise<void>;
    updateCurrentEntry(options: NavigationUpdateCurrentOptions<S>): void;

    navigate<NS extends S = S>(url: string, options?: NavigationNavigateOptions<NS>): NavigationResult<S>;
    reload<NS extends S = S>(options?: NavigationReloadOptions<NS>): NavigationResult<S>;

    goTo(key: string, options?: NavigationNavigationOptions): NavigationResult<S>;
    back(options?: NavigationNavigationOptions): NavigationResult<S>;
    forward(options?: NavigationNavigationOptions): NavigationResult<S>;

    onnavigate?: ((this: Navigation, ev: NavigateEvent<S>) => unknown | void) | null;
    onnavigatesuccess?: ((this: Navigation, ev: Event) => unknown | void) | null;
    onnavigateerror?: ((this: Navigation, ev: ErrorEvent) => unknown | void) | null;
    oncurrentchange?: ((this: Navigation, ev: NavigationCurrentEntryChangeEvent<S>) => unknown) | null;

    addEventListener<K extends keyof NavigationEventMap<S>>(type: K, listener: (ev: NavigationEventMap<S>[K]) => unknown | void, options?: boolean | EventTargetAddListenerOptions): void;
    addEventListener(type: string, listener: EventCallback, options?: boolean | EventTargetAddListenerOptions): void;
    removeEventListener<K extends keyof NavigationEventMap<S>>(type: K, listener: (ev: NavigationEventMap<S>[K]) => unknown, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventCallback, options?: boolean | EventListenerOptions): void;
}

export interface NavigationTransitionInit<S = unknown> {
    navigationType: NavigationNavigationType;
    from: NavigationHistoryEntry<S>;
    finished: Promise<NavigationHistoryEntry<S>>;
}

export interface NavigationTransition<S = unknown> extends NavigationTransitionInit {
    readonly navigationType: NavigationNavigationType;
    readonly from: NavigationHistoryEntry<S>;
    readonly finished: Promise<NavigationHistoryEntry<S>>;

    rollback(options?: NavigationNavigationOptions): NavigationResult<S>;
}

export interface NavigationHistoryEntryEventMap {
    "navigateto": Event;
    "navigatefrom": Event;
    "finish": Event;
    "dispose": Event;
}

export interface NavigationHistoryEntryInit<S = unknown> extends NavigationNavigateOptions<S> {
    key?: string;
    url?: string | null;
    index: number | (() => number);
    sameDocument?: boolean;
    [EventTargetListeners]?: EventDescriptor[];
}

export interface NavigationHistoryEntry<S = unknown> extends EventTarget {
    readonly key: string;
    readonly id: string;
    readonly url?: string;
    readonly index: number;
    readonly sameDocument: boolean;

    getState<ST extends S>(): ST;

    onnavigateto?: ((ev: Event) => unknown)|null;
    onnavigatefrom?: ((ev: Event) => unknown)|null;
    onfinish?: ((ev: Event) => unknown)|null;
    ondispose?: ((ev: Event) => unknown)|null;

    addEventListener<K extends keyof NavigationHistoryEntryEventMap>(type: K, listener: EventCallback<NavigationHistoryEntryEventMap[K]>, options?: boolean | EventTargetAddListenerOptions): void;
    addEventListener(type: string, listener: EventCallback, options?: boolean | EventTargetAddListenerOptions): void;
    removeEventListener<K extends keyof NavigationHistoryEntryEventMap>(type: K, listener: EventCallback, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventCallback, options?: boolean | EventListenerOptions): void;
}

export type NavigationNavigationType = 'reload'|'push'|'replace'|'traverse';

export interface NavigationUpdateCurrentOptions<S = unknown> {
    state: S;
}

export interface NavigationNavigationOptions {
    info?: unknown;
}

export interface NavigationNavigateOptions<S = unknown> extends NavigationNavigationOptions {
    state?: S;
    replace?: boolean;
}

export interface NavigationReloadOptions<S = unknown> extends NavigationNavigationOptions {
    state?: S;
}

export interface NavigationCurrentEntryChangeEventInit<S = unknown> extends EventInit {
    navigationType?: NavigationNavigationType ;
    from?: NavigationHistoryEntry<S>;
    startTime?: number;
}

export interface NavigationCurrentEntryChangeEvent<S = unknown> extends Event, NavigationCurrentEntryChangeEventInit {
    readonly navigationType?: NavigationNavigationType ;
    readonly from?: NavigationHistoryEntry<S>;
    transitionWhile?(newNavigationAction: Promise<unknown | void>): void;
}

export interface NavigateEvent<S = unknown> extends Event {
    preventDefault(): void;

    readonly navigationType: NavigationNavigationType;
    readonly canTransition: boolean;
    readonly userInitiated: boolean;
    readonly hashChange: boolean;
    readonly destination: NavigationDestination<S>;
    readonly signal: AbortSignal;
    readonly formData?: FormData ;
    readonly info: unknown;

    transitionWhile(newNavigationAction: Promise<unknown | void>): void;
}

export interface NavigateEventInit<S = unknown> extends EventInit {
    navigationType?: NavigationNavigationType;
    canTransition?: boolean;
    userInitiated?: boolean;
    hashChange?: boolean;
    destination: NavigationDestination<S>;
    signal: AbortSignal;
    formData?: FormData ;
    info?: unknown;
}

export interface NavigationDestination<S = unknown> {
    readonly url: string;
    readonly key?: string;
    readonly id?: string ;
    readonly index: number;
    readonly sameDocument: boolean;
    getState<GS extends S = S>(): GS;
    getState(): S;
}