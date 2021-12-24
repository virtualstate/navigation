import {
    AppHistoryEntry,
    AppHistoryNavigationOptions,
    AppHistoryNavigationType,
    AppHistoryResult,
    AppHistoryTransition as AppHistoryTransitionPrototype,
    AppHistoryTransitionInit as AppHistoryTransitionInitPrototype
} from "./spec/app-history";
import {Deferred} from "./util/deferred";

export const AppHistoryTransitionDeferred = Symbol.for("@virtualstate/app-history/transition/deferred");

export interface AppHistoryTransitionInit extends AppHistoryTransitionInitPrototype {
    rollback(options?: AppHistoryNavigationOptions): AppHistoryResult;
    [AppHistoryTransitionDeferred]: Deferred<AppHistoryEntry>;
}

export class AppHistoryTransition implements AppHistoryTransitionPrototype {
    readonly finished: Promise<AppHistoryEntry>;
    readonly from: AppHistoryEntry;
    readonly navigationType: AppHistoryNavigationType;

    #options: AppHistoryTransitionInit;

    get [AppHistoryTransitionDeferred]() {
        return this.#options[AppHistoryTransitionDeferred];
    }

    constructor(init: AppHistoryTransitionInit) {
        this.#options = init;
        this.finished = init.finished;
        this.from = init.from;
        this.navigationType = init.navigationType;
    }

    rollback(options?: AppHistoryNavigationOptions): AppHistoryResult {
        return this.#options.rollback(options);
    }

}