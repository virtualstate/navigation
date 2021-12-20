import {
    AppHistory,
    AppHistoryEntry,
    AppHistoryNavigationOptions,
    AppHistoryNavigationType, AppHistoryResult,
    AppHistoryTransition as AppHistoryTransitionPrototype, AppHistoryTransitionInit
} from "./app-history.prototype";

export class AppHistoryTransition implements AppHistoryTransitionPrototype {
    readonly finished: Promise<AppHistoryEntry>;
    readonly from: AppHistoryEntry;
    readonly navigationType: AppHistoryNavigationType;

    #options: AppHistoryTransitionInit & { history: AppHistory };

    constructor(init: AppHistoryTransitionInit & { history: AppHistory }) {
        this.#options = init;
        this.finished = init.finished;
        this.from = init.from;
        this.navigationType = init.navigationType;
    }

    rollback(options?: AppHistoryNavigationOptions): AppHistoryResult {
        return undefined;
    }

}