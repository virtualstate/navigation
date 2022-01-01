/**
 * This file is derived from https://github.com/WICG/app-history/blob/7c0332b30746b14863f717404402bc49e497a2b2/app_history.d.ts
 *
 * The main changes here is the usage of optional types over null, and support for updateCurrent()?.finished;
 *
 * null is still included in places where properties have been marked as optional
 *
 * Property based event listeners are not invoked, e.g. the below will not work
 *
 * e.g. appHistory.oncurrentchange = () => console.log("changed!")
 *
 * Instead use addEventListener
 */

import {AsyncEventTarget as EventTarget, EventCallback, Event, EventTargetListeners, EventDescriptor, EventTargetAddListenerOptions} from "../event-target";

export interface AppHistoryEventMap {
    "navigate": AppHistoryNavigateEvent;
    "navigatesuccess": Event;
    "navigateerror": Event & { error?: unknown };
    "currentchange": AppHistoryCurrentChangeEvent;
}

export interface AppHistoryResult {
    committed: Promise<AppHistoryEntry>;
    finished: Promise<AppHistoryEntry>;
}

export interface AppHistory extends EventTarget {

    readonly canGoBack: boolean;
    readonly canGoForward: boolean;
    readonly current?: AppHistoryEntry | null;
    readonly transition?: AppHistoryTransition | null;

    entries(): AppHistoryEntry[];
    updateCurrent(options: AppHistoryUpdateCurrentOptions): AppHistoryResult;
    updateCurrent(options: AppHistoryUpdateCurrentOptions): void;

    navigate(url: string, options?: AppHistoryNavigateOptions): AppHistoryResult;
    reload(options?: AppHistoryReloadOptions): AppHistoryResult;

    goTo(key: string, options?: AppHistoryNavigationOptions): AppHistoryResult;
    back(options?: AppHistoryNavigationOptions): AppHistoryResult;
    forward(options?: AppHistoryNavigationOptions): AppHistoryResult;

    // TODO, not implemented
    // onnavigate?: ((this: AppHistory, ev: AppHistoryNavigateEvent) => unknown) | null;
    // onnavigatesuccess?: ((this: AppHistory, ev: Event) => unknown) | null;
    // onnavigateerror?: ((this: AppHistory, ev: ErrorEvent) => unknown) | null;
    // oncurrentchange?: ((this: AppHistory, ev: AppHistoryCurrentChangeEvent) => unknown) | null;

    addEventListener<K extends keyof AppHistoryEventMap>(type: K, listener: (ev: AppHistoryEventMap[K]) => unknown, options?: boolean | EventTargetAddListenerOptions): void;
    addEventListener(type: string, listener: EventCallback, options?: boolean | EventTargetAddListenerOptions): void;
    removeEventListener<K extends keyof AppHistoryEventMap>(type: K, listener: (ev: AppHistoryEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventCallback, options?: boolean | EventListenerOptions): void;
}

export interface AppHistoryTransitionInit {
    navigationType: AppHistoryNavigationType;
    from: AppHistoryEntry;
    finished: Promise<AppHistoryEntry>;
}

export interface AppHistoryTransition extends AppHistoryTransitionInit {
    readonly navigationType: AppHistoryNavigationType;
    readonly from: AppHistoryEntry;
    readonly finished: Promise<AppHistoryEntry>;

    rollback(options?: AppHistoryNavigationOptions): AppHistoryResult;
}

export interface AppHistoryEntryEventMap {
    "navigateto": Event;
    "navigatefrom": Event;
    "finish": Event;
    "dispose": Event;
}

export interface AppHistoryEntryInit<S = unknown> extends AppHistoryNavigateOptions<S> {
    key?: string;
    url?: string | null;
    index: number | (() => number);
    sameDocument?: boolean;
    [EventTargetListeners]?: EventDescriptor[];
}

export interface AppHistoryEntry<S = unknown> extends EventTarget {
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

    addEventListener<K extends keyof AppHistoryEntryEventMap>(type: K, listener: EventCallback<AppHistoryEntryEventMap[K]>, options?: boolean | EventTargetAddListenerOptions): void;
    addEventListener(type: string, listener: EventCallback, options?: boolean | EventTargetAddListenerOptions): void;
    removeEventListener<K extends keyof AppHistoryEntryEventMap>(type: K, listener: EventCallback, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventCallback, options?: boolean | EventListenerOptions): void;
}

export type AppHistoryNavigationType = 'reload'|'push'|'replace'|'traverse';

export interface AppHistoryUpdateCurrentOptions {
    state: unknown;
}

export interface AppHistoryNavigationOptions {
    info?: unknown;
}

export interface AppHistoryNavigateOptions<S = unknown> extends AppHistoryNavigationOptions {
    state?: S;
    replace?: boolean;
}

export interface AppHistoryReloadOptions<S = unknown> extends AppHistoryNavigationOptions {
    state?: S;
}

export interface AppHistoryCurrentChangeEventInit extends EventInit {
    navigationType?: AppHistoryNavigationType ;
    from?: AppHistoryEntry;
    startTime?: number;
}

export interface AppHistoryCurrentChangeEvent extends Event, AppHistoryCurrentChangeEventInit {
    readonly navigationType?: AppHistoryNavigationType ;
    readonly from?: AppHistoryEntry;
    readonly startTime?: number;
    transitionWhile?(newNavigationAction: Promise<unknown>): void;
}

export interface AppHistoryNavigateEvent extends Event {
    preventDefault(): void;

    readonly navigationType: AppHistoryNavigationType;
    readonly canTransition: boolean;
    readonly userInitiated: boolean;
    readonly hashChange: boolean;
    readonly destination: AppHistoryDestination;
    readonly signal: AbortSignal;
    readonly formData?: FormData ;
    readonly info: unknown;

    transitionWhile(newNavigationAction: Promise<unknown>): void;
}

export interface AppHistoryNavigateEventInit extends EventInit {
    navigationType?: AppHistoryNavigationType;
    canTransition?: boolean;
    userInitiated?: boolean;
    hashChange?: boolean;
    destination: AppHistoryDestination;
    signal: AbortSignal;
    formData?: FormData ;
    info?: unknown;
}

export interface AppHistoryDestination {
    readonly url: string;
    readonly key: string;
    readonly id?: string ;
    readonly index: number;
    readonly sameDocument: boolean;
    getState<S>(): S;
    getState(): unknown;
}