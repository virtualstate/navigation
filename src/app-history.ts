import {
    AppHistoryEntry,
    AppHistoryEntryInit,
    AppHistoryEntryKnownAs,
    AppHistoryEntryNavigationType
} from "./app-history-entry";
import {
    AppHistory as AppHistoryPrototype,
    AppHistoryEventMap,
    AppHistoryNavigateOptions,
    AppHistoryNavigationOptions,
    AppHistoryReloadOptions,
    AppHistoryResult,
    AppHistoryUpdateCurrentOptions,
    AppHistoryTransition as AppHistoryTransitionPrototype
} from "./spec/app-history";
import {AppHistoryEventTarget} from "./app-history-event-target";
import {InvalidStateError} from "./app-history-errors";
import {EventTargetListeners} from "./event-target";
import AbortController from "abort-controller";
import {
    AppHistoryTransition,
    AppHistoryTransitionEntry,
    AppHistoryTransitionError,
    AppHistoryTransitionFinally,
    AppHistoryTransitionStart,
    AppHistoryTransitionInitialEntries,
    AppHistoryTransitionInitialIndex,
    AppHistoryTransitionKnown,
    AppHistoryTransitionNavigationType,
    AppHistoryTransitionParentEventTarget,
    AppHistoryTransitionPromises,
    AppHistoryTransitionWait,
    InternalAppHistoryNavigationType,
    Rollback,
    Unset,
    UpdateCurrent,
    AppHistoryTransitionWhile,
    AppHistoryTransitionStartDeadline,
    AppHistoryTransitionCommit,
    AppHistoryTransitionFinish, AppHistoryTransitionAbort
} from "./app-history-transition";
import {
    AppHistoryTransitionResult,
    createAppHistoryTransition,
    InternalAppHistoryNavigateOptions,
} from "./create-app-history-transition";
import {deferred} from "./util/deferred";

export * from "./spec/app-history";

export class AppHistory extends AppHistoryEventTarget<AppHistoryEventMap> implements AppHistoryPrototype {

    // Should be always 0 or 1
    #transitionInProgressCount = 0;

    #entries: AppHistoryEntry[] = [];
    #known = new Set<AppHistoryEntry>();
    #currentIndex = -1;
    #activePromise?: Promise<unknown>;
    #activeTransition?: AppHistoryTransition;

    #knownTransitions = new WeakSet();

    get canGoBack() {
       return !!this.#entries[this.#currentIndex - 1];
    };

    get canGoForward() {
        return !!this.#entries[this.#currentIndex + 1];
    };

    get current() {
        if (this.#currentIndex === -1) {
            return undefined;
        }
        return this.#entries[this.#currentIndex];
    };

    get transition(): AppHistoryTransitionPrototype | undefined {
        return this.#activeTransition;
    };

    back(options?: AppHistoryNavigationOptions): AppHistoryResult {
        if (!this.canGoBack) throw new InvalidStateError("Cannot go back");
        const entry = this.#entries[this.#currentIndex - 1];
        return this.#pushEntry("traverse", this.#cloneAppHistoryEntry(entry, {
            ...options,
            navigationType: "traverse"
        }));
    }

    entries(): AppHistoryEntry[] {
        return [...this.#entries];
    }

    forward(options?: AppHistoryNavigationOptions): AppHistoryResult {
        if (!this.canGoForward) throw new InvalidStateError();
        const entry = this.#entries[this.#currentIndex + 1];
        return this.#pushEntry("traverse", this.#cloneAppHistoryEntry(entry, {
            ...options,
            navigationType: "traverse"
        }));
    }

    goTo(key: string, options?: AppHistoryNavigationOptions): AppHistoryResult {
        const found = this.#entries.find(entry => entry.key === key);
        if (found) {
            return this.#pushEntry("traverse", this.#cloneAppHistoryEntry(found, {
                ...options,
                navigationType: "traverse"
            }));
        }
        throw new InvalidStateError();
    }

    navigate(url: string, options?: AppHistoryNavigateOptions): AppHistoryResult {
        const navigationType = options?.replace ? "replace" : "push";
        const entry = this.#createAppHistoryEntry({
            url,
            ...options,
            navigationType
        });
        return this.#pushEntry(
            navigationType,
            entry,
            undefined,
            options
        );
    }

    #cloneAppHistoryEntry = (entry?: AppHistoryEntry, options?: InternalAppHistoryNavigateOptions): AppHistoryEntry => {
        return this.#createAppHistoryEntry({
            ...entry,
            index: entry?.index ?? undefined,
            state: options?.state ?? entry?.getState(),
            navigationType: entry?.[AppHistoryEntryNavigationType] ?? (typeof options?.navigationType === "string" ? options.navigationType : "replace"),
            ...options,
            get [AppHistoryEntryKnownAs]() {
              return entry?.[AppHistoryEntryKnownAs];
            },
            get [EventTargetListeners]() {
                return entry?.[EventTargetListeners];
            }
        });
    }

    #createAppHistoryEntry = (options: Partial<AppHistoryEntryInit> & Omit<AppHistoryEntryInit, "index">) => {
        const entry: AppHistoryEntry = new AppHistoryEntry({
            ...options,
            index: options.index ?? (() => {
                return this.#entries.indexOf(entry);
            }),
        });
        return entry;

    }

    #pushEntry = (navigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry, transition?: AppHistoryTransition, options?: InternalAppHistoryNavigateOptions) => {
        /* c8 ignore start */
        if (entry === this.current) throw new InvalidStateError();
        const existingPosition = this.#entries.findIndex(existing => existing.id === entry.id);
        if (existingPosition > -1) {
            throw new InvalidStateError();
        }
        /* c8 ignore end */
        return this.#commitTransition(navigationType, entry, transition, options);
    };

    #commitTransition = (givenNavigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry,  transition?: AppHistoryTransition, options?: InternalAppHistoryNavigateOptions) => {
        const nextTransition: AppHistoryTransition = transition ?? new AppHistoryTransition({
            from: entry,
            navigationType: typeof givenNavigationType === "string" ? givenNavigationType : "replace",
            rollback: (options) => {
                return this.#rollback(nextTransition, options);
            },
            [AppHistoryTransitionNavigationType]: givenNavigationType,
            [AppHistoryTransitionInitialEntries]: [...this.#entries],
            [AppHistoryTransitionInitialIndex]: this.#currentIndex,
            [AppHistoryTransitionKnown]: [...this.#known],
            [AppHistoryTransitionEntry]: entry,
            [AppHistoryTransitionParentEventTarget]: this
        });
        const { finished, committed } = nextTransition;
        const handler = () => {
            return this.#immediateTransition(givenNavigationType, entry, nextTransition, options);
        };
        const previousPromise = this.#activePromise ?? Promise.resolve();
        let nextPromise;
        // console.log({ givenNavigationType });
        if (givenNavigationType === Rollback) {
            nextPromise = handler().then(() => previousPromise);
        } else {
            nextPromise = previousPromise.then(handler);
        }
        this.#activePromise = nextPromise.catch(error => void error);
        this.#queueTransition(nextTransition);
        return { committed, finished };

    }

    #queueTransition = (transition: AppHistoryTransition) => {
        // TODO consume errors that are not abort errors
        // transition.finished.catch(error => void error);
        this.#knownTransitions.add(transition);
    }

    #immediateTransition = async (givenNavigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry, transition: AppHistoryTransition, options?: InternalAppHistoryNavigateOptions) => {
        try {
            this.#transitionInProgressCount += 1;
            if (this.#transitionInProgressCount > 1 && !(givenNavigationType === Rollback || givenNavigationType === UpdateCurrent)) {
                throw new InvalidStateError("Unexpected multiple transitions");
            }
            await this.#transition(givenNavigationType, entry, transition, options);
        } finally {
            this.#transitionInProgressCount -= 1;
        }
    }

    #rollback = (rollbackTransition: AppHistoryTransition, options?: AppHistoryNavigationOptions): AppHistoryResult => {
        const previousEntries = rollbackTransition[AppHistoryTransitionInitialEntries];
        const previousIndex = rollbackTransition[AppHistoryTransitionInitialIndex];
        const previousCurrent = previousEntries[previousIndex];
        // console.log("z");
        // console.log("Rollback!", { previousCurrent, previousEntries, previousIndex });
        const entry = previousCurrent ? this.#cloneAppHistoryEntry(previousCurrent, options) : undefined;
        const nextOptions: InternalAppHistoryNavigateOptions = {
            ...options,
            index: previousIndex,
            known: new Set([...this.#known, ...previousEntries]),
            navigationType: entry?.[AppHistoryEntryNavigationType] ?? "replace",
            entries: previousEntries,
        } as const;
        const resolvedNavigationType = entry ? Rollback : Unset
        const resolvedEntry = entry ?? this.#createAppHistoryEntry({
            navigationType: "replace",
            index: nextOptions.index,
            sameDocument: true,
            ...options,
        });
        return this.#pushEntry(resolvedNavigationType, resolvedEntry, undefined, nextOptions);
    }

    #transition = async (givenNavigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry, transition: AppHistoryTransition, options?: InternalAppHistoryNavigateOptions) => {
        // console.log({ givenNavigationType, transition });
        let navigationType = givenNavigationType;

        const performance = await getPerformance();
        const startTime = performance.now();

        if (entry.sameDocument && typeof navigationType === "string") {
            performance.mark(`same-document-navigation:${entry.id}`);
        }

        const { current } = this;
        const completeTransition = async (): Promise<AppHistoryEntry> => {
            if (givenNavigationType !== UpdateCurrent) {
                this.#activeTransition?.[AppHistoryTransitionAbort]();
            }
            this.#activeTransition = transition;

            if (givenNavigationType === Unset && typeof options?.index === "number" && options.entries) {
                await asyncCommit({
                    entries: options.entries,
                    index: options.index,
                    known: options.known,
                });
                await this.dispatchEvent({
                    type: "currentchange"
                });
                return entry;
            }

            const transitionResult = await createAppHistoryTransition({
                current,
                currentIndex: this.#currentIndex,
                options,
                transition,
                startTime,
                known: this.#known
            });

            for (const promise of transitionSteps(transitionResult)) {
                await promise;
                if (transition.signal.aborted) {
                    break;
                }
            }
            // console.log("Returning", { entry });
            return entry;
        }

        interface Commit  {
            entries: AppHistoryEntry[];
            index: number;
            known?: Set<AppHistoryEntry>;
        }

        const syncCommit = ({ entries, index, known }: Commit) => {
            this.#entries = entries;
            if (known) {
                this.#known = new Set([...this.#known, ...(known)])
            }
            this.#currentIndex = index;
        }

        const asyncCommit = async (commit: Commit) => {
            syncCommit(commit);
            await transition.dispatchEvent({
                type: AppHistoryTransitionCommit,
                transition,
                entry
            });
        }

        const dispose = async () => this.#dispose();

        function *transitionSteps(transitionResult: AppHistoryTransitionResult): Iterable<Promise<unknown>> {
            const microtask = new Promise<void>(queueMicrotask);
            const {
                known,
                entries,
                index,
                currentChange,
                navigate,
            } = transitionResult;

            if (typeof navigationType === "string" || navigationType === Rollback) {
                const promise = current?.dispatchEvent({
                    type: "navigatefrom",
                    transitionWhile: transition[AppHistoryTransitionWhile],
                });
                if (promise) yield promise;
            }

            if (typeof navigationType === "string") {
                yield transition.dispatchEvent(navigate);
            }

            yield asyncCommit({
                entries: entries,
                index: index,
                known: known,
            });
            if (entry.sameDocument) {
                yield transition.dispatchEvent(currentChange);
            }
            if (typeof navigationType === "string") {
                yield entry.dispatchEvent({
                    type: "navigateto",
                    transitionWhile: transition[AppHistoryTransitionWhile],
                });
            }
            yield dispose();
            if (!transition[AppHistoryTransitionPromises].size) {
                yield microtask;
            }
            yield transition.dispatchEvent({
                type: AppHistoryTransitionStartDeadline,
                transition,
                entry
            });
            yield transition[AppHistoryTransitionWait]();
            yield transition.dispatchEvent({
                type: AppHistoryTransitionFinish,
                transition,
                entry,
                transitionWhile: transition[AppHistoryTransitionWhile]
            });
            if (typeof navigationType === "string") {
                yield transition.dispatchEvent({
                    type: "finish",
                    transitionWhile: transition[AppHistoryTransitionWhile]
                });
            }
            if (typeof navigationType === "string") {
                yield transition.dispatchEvent({
                    type: "navigatesuccess",
                    transitionWhile: transition[AppHistoryTransitionWhile]
                });
            }
            // If we have more length here, we have added more transition
            yield transition[AppHistoryTransitionWait]();
        }

        try {
            await transition.dispatchEvent({
                type: AppHistoryTransitionStart,
                transition,
                entry
            });
            return await completeTransition();
        } catch (error) {
            await transition.dispatchEvent({
                type: AppHistoryTransitionError,
                error,
                transition,
                entry
            });
            // console.log("Error for", entry, error);
            // Don't throw here, as this error will be handled by transition directly
            // throw await Promise.reject(error);
        } finally {
            await this.#dispose();
            await transition.dispatchEvent({
                type: AppHistoryTransitionFinally,
                transition,
                entry
            });
            await transition[AppHistoryTransitionWait]();
            if (this.#activeTransition === transition) {
                this.#activeTransition = undefined;
            }
            if (entry.sameDocument && typeof navigationType === "string") {
                performance.mark(`same-document-navigation-finish:${entry.id}`);
                performance.measure(
                    `same-document-navigation:${entry.url}`,
                    `same-document-navigation:${entry.id}`,
                    `same-document-navigation-finish:${entry.id}`
                );
            }
        }
    }

    #dispose = async () => {
        // console.log(JSON.stringify({ known: [...this.#known], entries: this.#entries }));
        for (const known of this.#known) {
            const index = this.#entries.findIndex(entry => entry.key === known.key);
            if (index !== -1) {
                // Still in use
                continue;
            }
            // No index, no longer known
            this.#known.delete(known);
            const event = {
                type: "dispose",
                entry: known
            };
            await known.dispatchEvent(event);
            await this.dispatchEvent(event);
        }
        // console.log(JSON.stringify({ pruned: [...this.#known] }));
    }

    reload(options?: AppHistoryReloadOptions): AppHistoryResult {
        const { current } = this;
        if (!current) throw new InvalidStateError();
        const entry = this.#cloneAppHistoryEntry(current, options);
        return this.#pushEntry("reload", entry, undefined, options);
    }

    updateCurrent(options: AppHistoryUpdateCurrentOptions): AppHistoryResult
    updateCurrent(options: AppHistoryUpdateCurrentOptions): void
    updateCurrent(options: AppHistoryUpdateCurrentOptions): AppHistoryResult {
        const { current } = this;
        const entry = this.#cloneAppHistoryEntry(current, options);
        return this.#pushEntry(UpdateCurrent, entry, undefined, options);
    }

}

async function getPerformance(): Promise<{
    now(): number;
    measure(name: string, start: string, finish: string): unknown;
    mark(mark: string): unknown;
}> {
    if (typeof performance !== "undefined") {
        return performance;
    }
    /* c8 ignore start */
    return {
        now() {
            return Date.now()
        },
        mark() {

        },
        measure() {
        }
    }
    // const { performance: nodePerformance } = await import("perf_hooks");
    // return nodePerformance;
    /* c8 ignore end */
}