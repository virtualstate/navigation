import {
    AppHistoryEntry as AppHistoryEntryPrototype,
    AppHistoryEntryEventMap,
    AppHistoryEntryInit as AppHistoryEntryInitPrototype,
    AppHistoryNavigationType
} from "./spec/app-history";
import {AppHistoryEventTarget} from "./app-history-event-target";
import {EventTargetListeners} from "./event-target";

const { v4 } = await import("uuid").catch(() => undefined).then((mod) => mod ?? ({ v4(): string {
    return `0101010-0101010-${Math.random()}`.replace(".", "");
}}));

export const AppHistoryEntryNavigationType = Symbol.for("@virtualstate/app-history/entry/navigationType");
export const AppHistoryEntryKnownAs = Symbol.for("@virtualstate/app-history/entry/knownAs");

export interface AppHistoryEntryInit<S = unknown> extends AppHistoryEntryInitPrototype<S> {
    navigationType: AppHistoryNavigationType;
    [AppHistoryEntryKnownAs]?: Set<string>;
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
    }

    getState<ST extends S>(): ST
    getState(): S
    getState(): unknown {
        return this.#options.state;
    }

}