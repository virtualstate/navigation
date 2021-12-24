import {
    AppHistoryEntry,
    AppHistoryNavigationOptions,
    AppHistoryNavigationType,
    AppHistoryResult,
    AppHistoryTransition as AppHistoryTransitionPrototype,
    AppHistoryTransitionInit as AppHistoryTransitionInitPrototype
} from "./spec/app-history";
import {Deferred} from "./util/deferred";

export const UpdateCurrent = Symbol.for("@virtualstate/app-history/updateCurrent");
export const Rollback = Symbol.for("@virtualstate/app-history/rollback");
export const Unset = Symbol.for("@virtualstate/app-history/unset");

export type InternalAppHistoryNavigationType =
    | AppHistoryNavigationType
    | typeof Rollback
    | typeof UpdateCurrent
    | typeof Unset;

export const AppHistoryTransitionDeferred = Symbol.for("@virtualstate/app-history/transition/deferred");
export const AppHistoryTransitionType = Symbol.for("@virtualstate/app-history/transition/type");

export interface AppHistoryTransitionInit extends AppHistoryTransitionInitPrototype {
    rollback(options?: AppHistoryNavigationOptions): AppHistoryResult;
    [AppHistoryTransitionDeferred]: Deferred<AppHistoryEntry>;
    [AppHistoryTransitionType]: InternalAppHistoryNavigationType;
}

export class AppHistoryTransition implements AppHistoryTransitionPrototype {
    readonly finished: Promise<AppHistoryEntry>;
    readonly from: AppHistoryEntry;
    readonly navigationType: AppHistoryNavigationType;

    #options: AppHistoryTransitionInit;

    get [AppHistoryTransitionDeferred]() {
        return this.#options[AppHistoryTransitionDeferred];
    }

    get [AppHistoryTransitionType]() {
        return this.#options[AppHistoryTransitionType];
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