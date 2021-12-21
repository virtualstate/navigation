import {
    AppHistory,
    AppHistoryEntry,
    AppHistoryNavigationOptions,
    AppHistoryNavigationType, AppHistoryResult,
    AppHistoryTransition as AppHistoryTransitionPrototype,
    AppHistoryTransitionInit as AppHistoryTransitionInitPrototype
} from "./app-history.prototype";

export interface AppHistoryTransitionInit extends AppHistoryTransitionInitPrototype {
    rollback(options?: AppHistoryNavigationOptions): AppHistoryResult;
    then: PromiseLike<AppHistoryEntry>["then"];
}

export class AppHistoryTransition implements AppHistoryTransitionPrototype {
    readonly finished: Promise<AppHistoryEntry>;
    readonly from: AppHistoryEntry;
    readonly navigationType: AppHistoryNavigationType;

    #options: AppHistoryTransitionInit;

    constructor(init: AppHistoryTransitionInit) {
        this.#options = init;
        this.finished = init.finished;
        this.from = init.from;
        this.navigationType = init.navigationType;
    }

    rollback(options?: AppHistoryNavigationOptions): AppHistoryResult {
        return this.#options.rollback(options);
    }

    then(resolve: (entry: AppHistoryEntry) => void, reject: (reason: unknown) => void) {
        return this.#options.then(resolve, reject);
    }

}