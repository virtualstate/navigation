import {
    AppHistoryEntry as AppHistoryEntryPrototype,
    AppHistoryNavigationOptions,
    AppHistoryNavigationType,
    AppHistoryResult,
    AppHistoryTransition as AppHistoryTransitionPrototype,
    AppHistoryTransitionInit as AppHistoryTransitionInitPrototype
} from "./spec/app-history";
import {AppHistoryEntry} from "./app-history-entry";
import {Deferred} from "./util/deferred";
import {InvalidStateError} from "./app-history-errors";
import {EventTarget} from "./event-target";

export const UpdateCurrent = Symbol.for("@virtualstate/app-history/updateCurrent");
export const Rollback = Symbol.for("@virtualstate/app-history/rollback");
export const Unset = Symbol.for("@virtualstate/app-history/unset");

export type InternalAppHistoryNavigationType =
    | AppHistoryNavigationType
    | typeof Rollback
    | typeof UpdateCurrent
    | typeof Unset;

export const AppHistoryTransitionParentEventTarget = Symbol.for("@virtualstate/app-history/transition/parentEventTarget");

export const AppHistoryTransitionDeferred = Symbol.for("@virtualstate/app-history/transition/deferred");
export const AppHistoryTransitionNavigationType = Symbol.for("@virtualstate/app-history/transition/navigationType");
export const AppHistoryTransitionInitialEntries = Symbol.for("@virtualstate/app-history/transition/entries/initial");
export const AppHistoryTransitionFinishedEntries = Symbol.for("@virtualstate/app-history/transition/entries/finished");
export const AppHistoryTransitionInitialIndex = Symbol.for("@virtualstate/app-history/transition/index/initial");
export const AppHistoryTransitionFinishedIndex = Symbol.for("@virtualstate/app-history/transition/index/finished");
export const AppHistoryTransitionEntry = Symbol.for("@virtualstate/app-history/transition/entry");

export const AppHistoryTransitionKnown = Symbol.for("@virtualstate/app-history/transition/known");
export const AppHistoryTransitionPromises = Symbol.for("@virtualstate/app-history/transition/promises");

export const AppHistoryTransitionWhile = Symbol.for("@virtualstate/app-history/transition/while");
export const AppHistoryTransitionWait = Symbol.for("@virtualstate/app-history/transition/wait");

export const AppHistoryTransitionPromiseResolved = Symbol.for("@virtualstate/app-history/transition/promise/resolved");
export const AppHistoryTransitionPromiseRejected = Symbol.for("@virtualstate/app-history/transition/promise/rejected");

export const AppHistoryTransitionStart = Symbol.for("@virtualstate/app-history/transition/start");
export const AppHistoryTransitionStartDeadline = Symbol.for("@virtualstate/app-history/transition/start/deadline");
export const AppHistoryTransitionError = Symbol.for("@virtualstate/app-history/transition/error");
export const AppHistoryTransitionFinally = Symbol.for("@virtualstate/app-history/transition/finally");
export const AppHistoryTransitionAbort = Symbol.for("@virtualstate/app-history/transition/abort");

export interface AppHistoryTransitionInit extends AppHistoryTransitionInitPrototype {
    rollback(options?: AppHistoryNavigationOptions): AppHistoryResult;
    [AppHistoryTransitionDeferred]: Deferred<AppHistoryEntry>;
    [AppHistoryTransitionNavigationType]: InternalAppHistoryNavigationType;
    [AppHistoryTransitionInitialEntries]: AppHistoryEntry[];
    [AppHistoryTransitionInitialIndex]: number;
    [AppHistoryTransitionFinishedEntries]?: AppHistoryEntry[];
    [AppHistoryTransitionFinishedIndex]?: number;
    [AppHistoryTransitionKnown]?: Iterable<AppHistoryEntry>;
    [AppHistoryTransitionEntry]: AppHistoryEntry;
    [AppHistoryTransitionParentEventTarget]: EventTarget;
}

export class AppHistoryTransition extends EventTarget implements AppHistoryTransitionPrototype {
    readonly finished: Promise<AppHistoryEntryPrototype>;
    readonly from: AppHistoryEntryPrototype;
    readonly navigationType: AppHistoryNavigationType;

    readonly #options: AppHistoryTransitionInit;

    get [AppHistoryTransitionDeferred](): Deferred<AppHistoryEntry> {
        return this.#options[AppHistoryTransitionDeferred];
    }

    get [AppHistoryTransitionNavigationType](): InternalAppHistoryNavigationType {
        return this.#options[AppHistoryTransitionNavigationType];
    }

    get [AppHistoryTransitionInitialEntries](): AppHistoryEntry[] {
        return this.#options[AppHistoryTransitionInitialEntries];
    }

    get [AppHistoryTransitionInitialIndex](): number {
        return this.#options[AppHistoryTransitionInitialIndex];
    }

    [AppHistoryTransitionFinishedEntries]?: AppHistoryEntry[];
    [AppHistoryTransitionFinishedIndex]?: number;

    readonly [AppHistoryTransitionKnown] = new Set<AppHistoryEntry>();
    readonly [AppHistoryTransitionEntry]: AppHistoryEntry;

    #promises = new Set<Promise<unknown>>()

    #rolledBack = false;

    #abortController = new AbortController();

    get signal() {
        return this.#abortController.signal;
    }

    get [AppHistoryTransitionPromises]() {
        return this.#promises;
    }

    constructor(init: AppHistoryTransitionInit) {
        super();

        this.#options = init;
        this.finished = init.finished;
        this.from = init.from;
        this.navigationType = init.navigationType;
        this[AppHistoryTransitionFinishedEntries] = init[AppHistoryTransitionFinishedEntries];
        this[AppHistoryTransitionFinishedIndex] = init[AppHistoryTransitionFinishedIndex];
        const known = init[AppHistoryTransitionKnown];
        if (known) {
            for (const entry of known) {
                this[AppHistoryTransitionKnown].add(entry);
            }
        }
        this[AppHistoryTransitionEntry] = init[AppHistoryTransitionEntry];

        this.addEventListener(
            "*",
            this[AppHistoryTransitionEntry].dispatchEvent.bind(this[AppHistoryTransitionEntry])
        );
        this.addEventListener(
            "*",
            init[AppHistoryTransitionParentEventTarget].dispatchEvent.bind(init[AppHistoryTransitionParentEventTarget])
        );
        this.addEventListener(
            "finish",
            init[AppHistoryTransitionDeferred].resolve.bind(undefined, this[AppHistoryTransitionEntry]),
            { once: true }
        );
    }

    rollback(options?: AppHistoryNavigationOptions): AppHistoryResult {
        if (this.#rolledBack) {
            // TODO
            throw new InvalidStateError("Rollback invoked multiple times: Please raise an issue at https://github.com/virtualstate/app-history with the use case where you want to use a rollback multiple times, this may have been unexpected behaviour");
        }
        return this.#options.rollback(options);
    }

    [AppHistoryTransitionPromiseResolved](...promises: Promise<unknown>[]) {
        for (const promise of promises) {
            this.#promises.delete(promise);
        }
    }

    [AppHistoryTransitionPromiseRejected](promise: Promise<unknown>) {
        // TODO decide if this fast track should be removed
        this[AppHistoryTransitionDeferred].reject(promise);
    }

    [AppHistoryTransitionWhile] = (promise: Promise<unknown>) => {
        this.#promises.add(promise);
    }

    async [AppHistoryTransitionWait]() {
        if (!this.#promises.size) return;
        const captured = [...this.#promises];
        const results = await Promise.allSettled(captured);
        const rejected = results.filter(({ status }) => status === "rejected");
        if (rejected.length) {
            // TODO
            throw await Promise.all(captured);
        }
        this[AppHistoryTransitionPromiseResolved](...captured);
    }

    [AppHistoryTransitionAbort]() {
        this.#abortController.abort();
        this.dispatchEvent({
            type: AppHistoryTransitionAbort,
            transition: this,
            entry: this[AppHistoryTransitionEntry]
        })
    }

}