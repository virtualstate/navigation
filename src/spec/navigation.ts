/**
 * This file is derived from https://github.com/WICG/app-history/blob/7c0332b30746b14863f717404402bc49e497a2b2/app_history.d.ts
 *
 * The main changes here is the usage of optional types over null, and support for updateCurrent()?.then;
 *
 * null is still included in places where properties have been marked as optional
 */

import {AsyncEventTarget as EventTarget, EventCallback, Event, EventTargetListeners, EventDescriptor, EventTargetAddListenerOptions} from "../event-target";

export interface NavigationEventMap {
    "navigate": NavigateEvent;
    "navigatesuccess": Event;
    "navigateerror": Event & { error?: unknown };
    "currentchange": NavigationCurrentEntryChangeEvent;
}

export interface NavigationResult {
    committed: Promise<NavigationHistoryEntry>;
    finished: Promise<NavigationHistoryEntry>;
}

export interface Navigation extends EventTarget {

    readonly canGoBack: boolean;
    readonly canGoForward: boolean;
    readonly currentEntry?: NavigationHistoryEntry | null;
    readonly transition?: NavigationTransition | null;

    entries(): NavigationHistoryEntry[];
    updateCurrentEntry(options: NavigationUpdateCurrentOptions): Promise<void>;
    updateCurrentEntry(options: NavigationUpdateCurrentOptions): void;

    navigate(url: string, options?: NavigationNavigateOptions): NavigationResult;
    reload(options?: NavigationReloadOptions): NavigationResult;

    goTo(key: string, options?: NavigationNavigationOptions): NavigationResult;
    back(options?: NavigationNavigationOptions): NavigationResult;
    forward(options?: NavigationNavigationOptions): NavigationResult;

    onnavigate?: ((this: Navigation, ev: NavigateEvent) => unknown) | null;
    onnavigatesuccess?: ((this: Navigation, ev: Event) => unknown) | null;
    onnavigateerror?: ((this: Navigation, ev: ErrorEvent) => unknown) | null;
    oncurrentchange?: ((this: Navigation, ev: NavigationCurrentEntryChangeEvent) => unknown) | null;

    addEventListener<K extends keyof NavigationEventMap>(type: K, listener: (ev: NavigationEventMap[K]) => unknown, options?: boolean | EventTargetAddListenerOptions): void;
    addEventListener(type: string, listener: EventCallback, options?: boolean | EventTargetAddListenerOptions): void;
    removeEventListener<K extends keyof NavigationEventMap>(type: K, listener: (ev: NavigationEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventCallback, options?: boolean | EventListenerOptions): void;
}

export interface NavigationTransitionInit {
    navigationType: NavigationNavigationType;
    from: NavigationHistoryEntry;
    finished: Promise<NavigationHistoryEntry>;
}

export interface NavigationTransition extends NavigationTransitionInit {
    readonly navigationType: NavigationNavigationType;
    readonly from: NavigationHistoryEntry;
    readonly finished: Promise<NavigationHistoryEntry>;

    rollback(options?: NavigationNavigationOptions): NavigationResult;
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

export interface NavigationUpdateCurrentOptions {
    state: unknown;
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

export interface NavigationCurrentEntryChangeEventInit extends EventInit {
    navigationType?: NavigationNavigationType ;
    from?: NavigationHistoryEntry;
    startTime?: number;
}

export interface NavigationCurrentEntryChangeEvent extends Event, NavigationCurrentEntryChangeEventInit {
    readonly navigationType?: NavigationNavigationType ;
    readonly from?: NavigationHistoryEntry;
    transitionWhile?(newNavigationAction: Promise<unknown>): void;
}

export interface NavigateEvent extends Event {
    preventDefault(): void;

    readonly navigationType: NavigationNavigationType;
    readonly canTransition: boolean;
    readonly userInitiated: boolean;
    readonly hashChange: boolean;
    readonly destination: NavigationDestination;
    readonly signal: AbortSignal;
    readonly formData?: FormData ;
    readonly info: unknown;

    transitionWhile(newNavigationAction: Promise<unknown>): void;
}

export interface NavigateEventInit extends EventInit {
    navigationType?: NavigationNavigationType;
    canTransition?: boolean;
    userInitiated?: boolean;
    hashChange?: boolean;
    destination: NavigationDestination;
    signal: AbortSignal;
    formData?: FormData ;
    info?: unknown;
}

export interface NavigationDestination {
    readonly url: string;
    readonly key?: string;
    readonly id?: string ;
    readonly index: number;
    readonly sameDocument: boolean;
    getState<S>(): S;
    getState(): unknown;
}