import {
    AppHistoryEntry as AppHistoryEntryPrototype,
    AppHistoryNavigationOptions,
    AppHistoryNavigationType,
    AppHistoryResult,
    AppHistoryTransition as AppHistoryTransitionPrototype,
    AppHistoryTransitionInit as AppHistoryTransitionInitPrototype
} from "./spec/app-history";
import {AppHistoryEntry} from "./app-history-entry";
import {deferred, Deferred} from "./util/deferred";
import {AbortError, InvalidStateError, isAbortError, isInvalidStateError} from "./app-history-errors";
import {Event, EventTarget} from "./event-target";

export const UpdateCurrent = Symbol.for("@virtualstate/app-history/updateCurrent");
export const Rollback = Symbol.for("@virtualstate/app-history/rollback");
export const Unset = Symbol.for("@virtualstate/app-history/unset");

export type InternalAppHistoryNavigationType =
    | AppHistoryNavigationType
    | typeof Rollback
    | typeof UpdateCurrent
    | typeof Unset;

export const AppHistoryTransitionParentEventTarget = Symbol.for("@virtualstate/app-history/transition/parentEventTarget");

export const AppHistoryTransitionFinishedDeferred = Symbol.for("@virtualstate/app-history/transition/deferred/finished");
export const AppHistoryTransitionCommittedDeferred = Symbol.for("@virtualstate/app-history/transition/deferred/committed");
export const AppHistoryTransitionNavigationType = Symbol.for("@virtualstate/app-history/transition/navigationType");
export const AppHistoryTransitionInitialEntries = Symbol.for("@virtualstate/app-history/transition/entries/initial");
export const AppHistoryTransitionFinishedEntries = Symbol.for("@virtualstate/app-history/transition/entries/finished");
export const AppHistoryTransitionInitialIndex = Symbol.for("@virtualstate/app-history/transition/index/initial");
export const AppHistoryTransitionFinishedIndex = Symbol.for("@virtualstate/app-history/transition/index/finished");
export const AppHistoryTransitionEntry = Symbol.for("@virtualstate/app-history/transition/entry");


export const AppHistoryTransitionIsCommitted = Symbol.for("@virtualstate/app-history/transition/isCommitted");
export const AppHistoryTransitionIsFinished = Symbol.for("@virtualstate/app-history/transition/isFinished");
export const AppHistoryTransitionIsRejected = Symbol.for("@virtualstate/app-history/transition/isRejected");

export const AppHistoryTransitionKnown = Symbol.for("@virtualstate/app-history/transition/known");
export const AppHistoryTransitionPromises = Symbol.for("@virtualstate/app-history/transition/promises");

export const AppHistoryTransitionWhile = Symbol.for("@virtualstate/app-history/transition/while");
export const AppHistoryTransitionWait = Symbol.for("@virtualstate/app-history/transition/wait");

export const AppHistoryTransitionPromiseResolved = Symbol.for("@virtualstate/app-history/transition/promise/resolved");

export const AppHistoryTransitionRejected = Symbol.for("@virtualstate/app-history/transition/rejected");

export const AppHistoryTransitionCommit = Symbol.for("@virtualstate/app-history/transition/commit");
export const AppHistoryTransitionFinish = Symbol.for("@virtualstate/app-history/transition/finish");
export const AppHistoryTransitionStart = Symbol.for("@virtualstate/app-history/transition/start");
export const AppHistoryTransitionStartDeadline = Symbol.for("@virtualstate/app-history/transition/start/deadline");
export const AppHistoryTransitionError = Symbol.for("@virtualstate/app-history/transition/error");
export const AppHistoryTransitionFinally = Symbol.for("@virtualstate/app-history/transition/finally");
export const AppHistoryTransitionAbort = Symbol.for("@virtualstate/app-history/transition/abort");

export interface AppHistoryTransitionInit extends Omit<AppHistoryTransitionInitPrototype, "finished"> {
    rollback(options?: AppHistoryNavigationOptions): AppHistoryResult;
    [AppHistoryTransitionFinishedDeferred]?: Deferred<AppHistoryEntry>;
    [AppHistoryTransitionCommittedDeferred]?: Deferred<AppHistoryEntry>;
    [AppHistoryTransitionNavigationType]: InternalAppHistoryNavigationType;
    [AppHistoryTransitionInitialEntries]: AppHistoryEntry[];
    [AppHistoryTransitionInitialIndex]: number;
    [AppHistoryTransitionFinishedEntries]?: AppHistoryEntry[];
    [AppHistoryTransitionFinishedIndex]?: number;
    [AppHistoryTransitionKnown]?: Iterable<EventTarget>;
    [AppHistoryTransitionEntry]: AppHistoryEntry;
    [AppHistoryTransitionParentEventTarget]: EventTarget;
}

export class AppHistoryTransition extends EventTarget implements AppHistoryTransitionPrototype {
    readonly finished: Promise<AppHistoryEntryPrototype>;
    /**
     * @experimental
     */
    readonly committed: Promise<AppHistoryEntryPrototype>;
    readonly from: AppHistoryEntryPrototype;
    readonly navigationType: AppHistoryNavigationType;

    readonly #options: AppHistoryTransitionInit;

    readonly [AppHistoryTransitionFinishedDeferred] = deferred<AppHistoryEntry>();
    readonly [AppHistoryTransitionCommittedDeferred] = deferred<AppHistoryEntry>();

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
    [AppHistoryTransitionIsCommitted] = false;
    [AppHistoryTransitionIsFinished] = false;
    [AppHistoryTransitionIsRejected] = false;

    readonly [AppHistoryTransitionKnown] = new Set<EventTarget>();
    readonly [AppHistoryTransitionEntry]: AppHistoryEntry;

    #promises = new Set<Promise<PromiseSettledResult<void>>>()

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
        this[AppHistoryTransitionFinishedDeferred] =
            init[AppHistoryTransitionFinishedDeferred] ?? this[AppHistoryTransitionFinishedDeferred];
        this[AppHistoryTransitionCommittedDeferred] =
            init[AppHistoryTransitionCommittedDeferred] ?? this[AppHistoryTransitionCommittedDeferred];

        this.#options = init;
        this.finished = this[AppHistoryTransitionFinishedDeferred].promise;
        this.committed = this[AppHistoryTransitionCommittedDeferred].promise;
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


        // Event listeners
        {
            // Events to promises
            {
                this.addEventListener(
                    AppHistoryTransitionCommit,
                    this.#onCommitPromise,
                    { once: true }
                );
                this.addEventListener(
                    AppHistoryTransitionFinish,
                    this.#onFinishPromise,
                    { once: true }
                );
            }

            // Events to property setters
            {
                this.addEventListener(
                    AppHistoryTransitionCommit,
                    this.#onCommitSetProperty,
                    { once: true }
                );
                this.addEventListener(
                    AppHistoryTransitionFinish,
                    this.#onFinishSetProperty,
                    { once: true }
                );
            }

            // Rejection + Abort
            {

                this.addEventListener(
                    AppHistoryTransitionError,
                    this.#onError,
                    { once: true }
                );
                this.addEventListener(
                    AppHistoryTransitionAbort,
                    () => this[AppHistoryTransitionRejected](new AbortError())
                )
            }

            // Proxy all events from this transition onto entry + the parent event target
            //
            // The parent could be another transition, or the appHistory, this allows us to
            // "bubble up" events layer by layer
            //
            // In this implementation, this allows individual transitions to "intercept" navigate and break the child
            // transition from happening
            //
            // TODO WARN this may not be desired behaviour vs standard spec'd appHistory
            {
                this.addEventListener(
                    "*",
                    this[AppHistoryTransitionEntry].dispatchEvent.bind(this[AppHistoryTransitionEntry])
                );
                this.addEventListener(
                    "*",
                    init[AppHistoryTransitionParentEventTarget].dispatchEvent.bind(init[AppHistoryTransitionParentEventTarget])
                );
            }
        }
    }

    rollback = (options?: AppHistoryNavigationOptions): AppHistoryResult => {
        // console.log({ rolled: this.#rolledBack });
        if (this.#rolledBack) {
            // TODO
            throw new InvalidStateError("Rollback invoked multiple times: Please raise an issue at https://github.com/virtualstate/app-history with the use case where you want to use a rollback multiple times, this may have been unexpected behaviour");
        }
        this.#rolledBack = true;
        return this.#options.rollback(options);
    }

    #onCommitSetProperty = () => {
        this[AppHistoryTransitionIsCommitted] = true
    }

    #onFinishSetProperty = () => {
        this[AppHistoryTransitionIsFinished] = true
    }

    #onFinishPromise = () => {
        // console.log("onFinishPromise")
        this[AppHistoryTransitionFinishedDeferred].resolve(
            this[AppHistoryTransitionEntry]
        );
    }

    #onCommitPromise = () => {
        this[AppHistoryTransitionCommittedDeferred].resolve(
            this[AppHistoryTransitionEntry]
        );
    }

    #onError = (event: Event & { error: unknown }) => {
        return this[AppHistoryTransitionRejected](event.error);
    }

    [AppHistoryTransitionPromiseResolved] = (...promises: Promise<PromiseSettledResult<void>>[]) => {
        for (const promise of promises) {
            this.#promises.delete(promise);
        }
    }

    [AppHistoryTransitionRejected] = async (reason: unknown) => {
        if (this[AppHistoryTransitionIsRejected]) return;
        this[AppHistoryTransitionIsRejected] = true;
        this[AppHistoryTransitionAbort]();

        const navigationType = this[AppHistoryTransitionNavigationType];

        // console.log({ navigationType, reason, entry: this[AppHistoryTransitionEntry] });

        if (!(isInvalidStateError(reason) || isAbortError(reason)) && (typeof navigationType === "string" || navigationType === Rollback)) {
            // console.log("navigateerror", { reason, z: isInvalidStateError(reason) });
            await this.dispatchEvent({
                type: "navigateerror",
                error: reason,
                get message() {
                    if (reason instanceof Error) {
                        return reason.message;
                    }
                    return `${reason}`;
                }
            });
            // console.log("navigateerror finished");

            if (navigationType !== Rollback) {
                try {

                    // console.log("Rollback", navigationType);
                    // console.warn("Rolling back immediately due to internal error", error);
                    await this.rollback().finished;
                    // console.log("Rollback complete", navigationType);
                } catch (error) {
                    // console.error("Failed to rollback", error);
                    throw new InvalidStateError("Failed to rollback, please raise an issue at https://github.com/virtualstate/app-history/issues");
                }
            }
        }
        this[AppHistoryTransitionCommittedDeferred].reject(reason);
        this[AppHistoryTransitionFinishedDeferred].reject(reason);
    }

    [AppHistoryTransitionWhile] = (promise: Promise<unknown>): void => {
        // console.log({ AppHistoryTransitionWhile, promise });
        const statusPromise = promise
            .then((): PromiseSettledResult<void> => ({
                status: "fulfilled",
                value: undefined
            }))
            .catch(async (reason): Promise<PromiseSettledResult<void>> => {
                await this[AppHistoryTransitionRejected](reason);
                return {
                    status: "rejected",
                    reason
                }
            });
        this.#promises.add(statusPromise);
    }

    [AppHistoryTransitionWait] = async (): Promise<AppHistoryEntry> => {
        if (!this.#promises.size) return this[AppHistoryTransitionEntry];
        const captured = [...this.#promises];
        const results = await Promise.all(captured);
        const rejected = results.filter<PromiseRejectedResult>(
            (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        // console.log({ rejected, results, captured });
        if (rejected.length) {
            // TODO handle differently when there are failures, e.g. we could move navigateerror to here
            if (rejected.length === 1) {
                throw await Promise.reject(rejected[0].reason)
            }
            if (typeof AggregateError !== "undefined") {
                throw new AggregateError(rejected.map(({ reason }) => reason));
            }
            throw new Error();
        }
        this[AppHistoryTransitionPromiseResolved](...captured);
        // console.log({ promises: this.#promises.size, matching: captured.filter(c => this.#promises.has(c)) })
        if (this.#promises.size) {
            return this[AppHistoryTransitionWait]();
        }

        return this[AppHistoryTransitionEntry];
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