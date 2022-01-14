import {
    AppHistory,
    AppHistoryEntry,
    AppHistoryEventMap,
    AppHistoryNavigationOptions,
    AppHistoryReloadOptions,
    AppHistoryResult, AppHistoryUpdateCurrentOptions
} from "./spec/app-history";
import {
    EventCallback,
    EventTargetAddListenerOptions,
    SyncEventCallback,
    Event,
    EventTargetListeners as EventTargetListenersSymbol,
    EventDescriptor
} from "./event-target";
import { AppHistoryNavigateOptions } from "./create-app-history-transition";

export interface AppHistoryAppHistory {
    new (thisValue: AppHistory): AppHistoryAppHistory;
}

export class AppHistoryAppHistory implements AppHistory {

    [key: string]: unknown;

    #appHistory: AppHistory;

    get [EventTargetListenersSymbol](): EventDescriptor[] | undefined {
        return [];
    }

    constructor(appHistory: AppHistory) {
        this.#appHistory = appHistory;
    }

    get canGoBack() {
        return this.#appHistory.canGoBack;
    }

    get canGoForward() {
        return this.#appHistory.canGoForward;
    }

    get current() {
        return this.#appHistory.current;
    }

    set oncurrentchange(value: AppHistory["oncurrentchange"]) {
        this.#appHistory.oncurrentchange = value;
    }
    set onnavigate(value: AppHistory["onnavigate"]) {
        this.#appHistory.onnavigate = value;
    }
    set onnavigateerror(value: AppHistory["onnavigateerror"]) {
        this.#appHistory.onnavigateerror = value;
    }
    set onnavigatesuccess(value: AppHistory["onnavigatesuccess"]) {
        this.#appHistory.onnavigatesuccess = value;
    }
    get transition() {
        return this.#appHistory.transition;
    }

    addEventListener<K extends keyof AppHistoryEventMap>(type: K, listener: (ev: AppHistoryEventMap[K]) => unknown, options?: boolean | EventTargetAddListenerOptions): void;
    addEventListener(type: string, listener: EventCallback, options?: boolean | EventTargetAddListenerOptions): void;
    addEventListener(type: string | symbol, callback: EventCallback, options?: EventTargetAddListenerOptions): void;
    addEventListener(type: string, callback: EventCallback, options?: EventTargetAddListenerOptions): void;
    addEventListener(type: string | symbol, callback: Function, options?: EventTargetAddListenerOptions): void;
    addEventListener(type: string | symbol, listener: EventCallback, options?: boolean | EventTargetAddListenerOptions): void {
        if (typeof type === "string") {
            this.#appHistory.addEventListener(type, listener, typeof options === "boolean" ? { once: true } : options);
        }
    }

    back(options?: AppHistoryNavigationOptions): AppHistoryResult {
        return this.#appHistory.back(options);
    }

    dispatchEvent(event: Event): Promise<void>
    dispatchEvent(event: Event): void
    dispatchEvent(event: Event): void | Promise<void> {
        return this.#appHistory.dispatchEvent(event);
    }

    entries(): AppHistoryEntry[] {
        return this.#appHistory.entries();
    }

    forward(options?: AppHistoryNavigationOptions): AppHistoryResult {
        return this.#appHistory.forward(options);
    }

    goTo(key: string, options?: AppHistoryNavigationOptions): AppHistoryResult {
        return this.#appHistory.goTo(key, options);
    }

    hasEventListener(type: string | symbol, callback?: Function): boolean;
    hasEventListener(type: string, callback?: Function): boolean;
    hasEventListener(type: string | symbol, callback?: Function): boolean {
        return this.#appHistory.hasEventListener(type, callback);
    }

    navigate(url: string, options?: AppHistoryNavigateOptions): AppHistoryResult {
        return this.#appHistory.navigate(url, options);
    }

    reload(options?: AppHistoryReloadOptions): AppHistoryResult {
        return this.#appHistory.reload(options);
    }

    removeEventListener<K extends keyof AppHistoryEventMap>(type: K, listener: (ev: AppHistoryEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventCallback, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string | symbol, callback: Function, options?: unknown): void;
    removeEventListener(type: string, callback: SyncEventCallback<Event>, options?: unknown): void;
    removeEventListener(type: string | symbol, listener: EventCallback, options?: unknown): void {
        if (typeof type === "string") {
            return this.#appHistory.removeEventListener(type, listener, options);
        }
    }

    updateCurrent(options: AppHistoryUpdateCurrentOptions): Promise<void>;
    updateCurrent(options: AppHistoryUpdateCurrentOptions): void;
    updateCurrent(options: AppHistoryUpdateCurrentOptions): Promise<void> | void {
        return this.#appHistory.updateCurrent(options);
    }

}