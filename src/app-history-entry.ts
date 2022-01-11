import {
    AppHistoryEntry as AppHistoryEntryPrototype,
    AppHistoryEntryEventMap,
    AppHistoryEntryInit as AppHistoryEntryInitPrototype,
    AppHistoryNavigationType
} from "./spec/app-history";
import {AppHistoryEventTarget} from "./app-history-event-target";
import {EventTargetListeners} from "./event-target";
import { v4 } from "./util/uuid-or-random";

export const AppHistoryEntryNavigationType = Symbol.for("@virtualstate/app-history/entry/navigationType");
export const AppHistoryEntryKnownAs = Symbol.for("@virtualstate/app-history/entry/knownAs");
export const AppHistoryEntrySetState = Symbol.for("@virtualstate/app-history/entry/setState");

export interface AppHistoryEntryInit<S = unknown> extends AppHistoryEntryInitPrototype<S> {
    navigationType: AppHistoryNavigationType;
    [AppHistoryEntryKnownAs]?: Set<string>;
}

export class AppHistoryEntry<S = unknown> extends AppHistoryEventTarget<AppHistoryEntryEventMap> implements AppHistoryEntryPrototype<S> {

    #index: number | (() => number);
    #state: S | undefined;

    get index() {
        return typeof this.#index === "number" ? this.#index : this.#index();
    }

    public readonly key: string;
    public readonly id: string;
    public readonly url?: string;
    public readonly sameDocument: boolean;

    get [AppHistoryEntryNavigationType]() {
        return this.#options.navigationType;
    }

    get [AppHistoryEntryKnownAs]() {
        const set = new Set(this.#options[AppHistoryEntryKnownAs]);
        set.add(this.id);
        return set;
    }

    #options: AppHistoryEntryInit<S>;

    get [EventTargetListeners]() {
        return [...(super[EventTargetListeners] ?? []), ...(this.#options[EventTargetListeners] ?? [])];
    }

    constructor(init: AppHistoryEntryInit<S>) {
        super();
        this.#options = init;
        this.key = init.key || v4();
        this.id = v4();
        this.url = init.url ?? undefined;
        this.#index = init.index;
        this.sameDocument = init.sameDocument ?? true;
        this.#state = init.state;
    }

    getState<ST extends S>(): ST
    getState(): S
    getState(): unknown {
        const state = this.#state;
        /**
         * https://github.com/WICG/app-history/blob/7c0332b30746b14863f717404402bc49e497a2b2/spec.bs#L1406
         * Note that in general, unless the state value is a primitive, entry.getState() !== entry.getState(), since a fresh copy is returned each time.
         */
        if (
            typeof state === "undefined" ||
            typeof state === "number" ||
            typeof state === "boolean" ||
            typeof state === "symbol" ||
            typeof state === "bigint" ||
            typeof state === "string"
        ) {
            return state;
        }
        if (typeof state === "function") {
            console.warn("State passed to appHistory.navigate was a function, this may be unintentional");
            console.warn("Unless a state value is primitive, with a standard implementation of appHistory");
            console.warn("your state value will be serialized and deserialized before this point, meaning");
            console.warn("a function would not be usable.");
        }
        return {
            ...state
        };
    }

    [AppHistoryEntrySetState](state: S) {
        this.#state = state;
    }



}