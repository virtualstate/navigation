import {EventTarget, Event, EventTargetListeners, EventDescriptor} from "@opennetwork/environment";

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
    updateCurrent(options: AppHistoryUpdateCurrentOptions): void;

    navigate(url: string, options?: AppHistoryNavigateOptions): AppHistoryResult;
    reload(options?: AppHistoryReloadOptions): AppHistoryResult;

    goTo(key: string, options?: AppHistoryNavigationOptions): AppHistoryResult;
    back(options?: AppHistoryNavigationOptions): AppHistoryResult;
    forward(options?: AppHistoryNavigationOptions): AppHistoryResult;

    onnavigate?: ((this: AppHistory, ev: AppHistoryNavigateEvent) => unknown) | null;
    onnavigatesuccess?: ((this: AppHistory, ev: Event) => unknown) | null;
    onnavigateerror?: ((this: AppHistory, ev: ErrorEvent) => unknown) | null;
    oncurrentchange?: ((this: AppHistory, ev: AppHistoryCurrentChangeEvent) => unknown) | null;

    addEventListener<K extends keyof AppHistoryEventMap>(type: K, listener: (this: AppHistory, ev: AppHistoryEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof AppHistoryEventMap>(type: K, listener: (this: AppHistory, ev: AppHistoryEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
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
    readonly url?: string | null;
    readonly index: number;
    readonly sameDocument: boolean;

    getState<ST extends S>(): ST;

    onnavigateto?: ((this: AppHistoryEntry, ev: Event) => unknown)|null;
    onnavigatefrom?: ((this: AppHistoryEntry, ev: Event) => unknown)|null;
    onfinish?: ((this: AppHistoryEntry, ev: Event) => unknown)|null;
    ondispose?: ((this: AppHistoryEntry, ev: Event) => unknown)|null;

    addEventListener<K extends keyof AppHistoryEntryEventMap>(type: K, listener: (this: AppHistory, ev: AppHistoryEntryEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof AppHistoryEntryEventMap>(type: K, listener: (this: AppHistory, ev: AppHistoryEntryEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
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
    navigationType?: AppHistoryNavigationType | null;
    from: AppHistoryEntry;
    startTime?: number;
}

export interface AppHistoryCurrentChangeEvent extends Event, AppHistoryCurrentChangeEventInit {
    readonly navigationType?: AppHistoryNavigationType | null;
    readonly from: AppHistoryEntry;
    readonly startTime?: number;
}

export interface AppHistoryNavigateEvent extends Event {
    preventDefault(): void;

    readonly navigationType: AppHistoryNavigationType;
    readonly canTransition: boolean;
    readonly userInitiated: boolean;
    readonly hashChange: boolean;
    readonly destination: AppHistoryDestination;
    readonly signal: AbortSignal;
    readonly formData?: FormData | null;
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
    formData?: FormData | null;
    info?: unknown;
}

export interface AppHistoryDestination {
    readonly url: string;
    readonly key?: string | null;
    readonly id?: string | null;
    readonly index: number;
    readonly sameDocument: boolean;
    getState(): unknown;
}