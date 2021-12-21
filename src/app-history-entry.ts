import {
    AppHistory,
    AppHistoryEntry as AppHistoryEntryPrototype,
    AppHistoryEntryEventMap,
    AppHistoryEntryInit as AppHistoryEntryInitPrototype,
    AppHistoryNavigationType
} from "./app-history.prototype";
import {AppHistoryEventTarget} from "./app-history-event-target";
import {v4} from "uuid";
import {EventTargetListeners} from "@opennetwork/environment";

/**
 * @internal
 */
export const AppHistoryEntryNavigationType = Symbol.for("@virtualstate/app-history/entry/navigationType");
/**
 * @experimental
 */
export const AppHistoryEntryKeyedState = Symbol.for("@virtualstate/app-history/entry/keyedState");

export interface AppHistoryEntryInit<S = unknown> extends AppHistoryEntryInitPrototype<S> {
    navigationType: AppHistoryNavigationType
    [AppHistoryEntryKeyedState]: Map<string, S>
}

export class AppHistoryEntry<S = unknown> extends AppHistoryEventTarget<AppHistoryEntryEventMap> implements AppHistoryEntryPrototype<S> {

    #index: number | (() => number);

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
    }

    getState<ST extends S>(): ST
    getState(): S
    getState(): S {
        // const keyed = this.#options[AppHistoryEntryKeyedState]?.get(this.key);
        return this.#options.state;
    }

}