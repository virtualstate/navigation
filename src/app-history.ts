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
import {AsyncEventTarget, EventTargetListeners} from "./event-target";
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
import {createEvent} from "./event-target/create-event";

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
        const previousPromise = this.#activePromise;
        let nextPromise: Promise<unknown> | undefined;
        if (givenNavigationType === Rollback || givenNavigationType === UpdateCurrent) {
            nextPromise = handler();
        } else {
            if (previousPromise) {
                nextPromise = previousPromise.then(handler);
            } else {
                nextPromise = handler();
            }
        }
        if (nextPromise && "then" in nextPromise) {
            const promise = Promise.resolve(nextPromise)
                .catch(error => void error)
                .then(() => {
                    if (promise === this.#activePromise) {
                        this.#activePromise = undefined;
                    }
                })

            this.#activePromise = promise;
        }

        void handler()
        this.#queueTransition(nextTransition);
        return { committed, finished };

    }

    #queueTransition = (transition: AppHistoryTransition) => {
        // TODO consume errors that are not abort errors
        // transition.finished.catch(error => void error);
        this.#knownTransitions.add(transition);
    }

    #immediateTransition = (givenNavigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry, transition: AppHistoryTransition, options?: InternalAppHistoryNavigateOptions) => {
        try {
            this.#transitionInProgressCount += 1;
            if (this.#transitionInProgressCount > 1 && !(givenNavigationType === Rollback || givenNavigationType === UpdateCurrent)) {
                throw new InvalidStateError("Unexpected multiple transitions");
            }
            return this.#transition(givenNavigationType, entry, transition, options);
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

    #transition = (givenNavigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry, transition: AppHistoryTransition, options?: InternalAppHistoryNavigateOptions) => {
        // console.log({ givenNavigationType, transition });
        let navigationType = givenNavigationType;

        const performance = getPerformance();
        const startTime = performance.now();

        if (entry.sameDocument && typeof navigationType === "string") {
            performance.mark(`same-document-navigation:${entry.id}`);
        }

        const { current } = this;
        const completeTransition = (): void | Promise<void> => {
            if (givenNavigationType !== UpdateCurrent) {
                this.#activeTransition?.[AppHistoryTransitionAbort]();
            }
            this.#activeTransition = transition;

            if (givenNavigationType === Unset && typeof options?.index === "number" && options.entries) {
                return swapAsync(undefined, [dispatchCommitChange({
                    entries: options.entries,
                    index: options.index,
                    known: options.known,
                })]);
            }

            const transitionResult = createAppHistoryTransition({
                current,
                currentIndex: this.#currentIndex,
                options,
                transition,
                startTime,
                known: this.#known
            });

            return swapAsync(undefined, transitionSteps(transitionResult));
        }

        interface Commit  {
            entries: AppHistoryEntry[];
            index: number;
            known?: Set<AppHistoryEntry>;
        }

        const doCommit = ({ entries, index, known }: Commit) => {
            this.#entries = entries;
            if (known) {
                this.#known = new Set([...this.#known, ...(known)])
            }
            this.#currentIndex = index;
        }

        const dispatchCommit = (commit: Commit) => {
            doCommit(commit);
            return transition.dispatchEvent(
                createEvent(
                    {
                        type: AppHistoryTransitionCommit,
                        transition,
                        entry
                    }
                )
            );
        }

        const dispatchCommitChange = (commit: Commit) => {
            return swapAsync(undefined, [
                dispatchCommit(commit),
                transition.dispatchEvent(
                    createEvent({
                        type: "currentchange"
                    })
                )
            ])
        }

        function *transitionSteps(transitionResult: AppHistoryTransitionResult): Iterable<Promise<unknown>> {
            const microtask = new Promise<void>(queueMicrotask);
            const {
                known,
                entries,
                index,
                currentChange,
                navigate,
            } = transitionResult;

            yield transition.dispatchEvent({
                type: AppHistoryTransitionStart,
                transition,
                entry
            });

            if (typeof navigationType === "string" || navigationType === Rollback) {
                const promise = current?.dispatchEvent(
                    createEvent({
                        type: "navigatefrom",
                        transitionWhile: transition[AppHistoryTransitionWhile],
                    })
                );
                if (promise) yield promise;
            }

            if (typeof navigationType === "string") {
                yield transition.dispatchEvent(navigate);
            }

            yield dispatchCommit({
                entries: entries,
                index: index,
                known: known,
            });
            if (entry.sameDocument) {
                yield transition.dispatchEvent(currentChange);
            }
            if (typeof navigationType === "string") {
                yield entry.dispatchEvent(
                    createEvent({
                        type: "navigateto",
                        transitionWhile: transition[AppHistoryTransitionWhile],
                    })
                );
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
                yield transition.dispatchEvent(
                    createEvent({
                        type: "finish",
                        transitionWhile: transition[AppHistoryTransitionWhile]
                    })
                );
            }
            if (typeof navigationType === "string") {
                yield transition.dispatchEvent(
                    createEvent({
                        type: "navigatesuccess",
                        transitionWhile: transition[AppHistoryTransitionWhile]
                    })
                );
            }
            // If we have more length here, we have added more transition
            yield transition[AppHistoryTransitionWait]();

            if (entry.sameDocument && typeof navigationType === "string") {
                performance.mark(`same-document-navigation-finish:${entry.id}`);
                performance.measure(
                    `same-document-navigation:${entry.url}`,
                    `same-document-navigation:${entry.id}`,
                    `same-document-navigation-finish:${entry.id}`
                );
            }
        }

        const dispose = () => this.#dispose();
        const removeActiveTransition = () => {
            if (this.#activeTransition === transition) {
                this.#activeTransition = undefined;
            }
        };

        try {
            let returnValue: void | Promise<void> = completeTransition();
            if (returnValue && "then" in returnValue) {
                returnValue = returnValue.catch(error => {
                    return transition.dispatchEvent({
                        type: AppHistoryTransitionError,
                        error,
                        transition,
                        entry
                    });
                })
            }
            return swapAsync(returnValue, transitionFinally());
        } catch (e) {
            return swapAsync(undefined, transitionError(e));
        }

        function *transitionError(error: unknown) {
            yield transition.dispatchEvent({
                type: AppHistoryTransitionError,
                error,
                transition,
                entry
            });
            yield * transitionFinally();
        }

        function *transitionFinally() {
            yield dispose();
            yield transition.dispatchEvent({
                type: AppHistoryTransitionFinally,
                transition,
                entry
            });
            yield transition[AppHistoryTransitionWait]();
            removeActiveTransition();
        }

        function swapAsync<T>(returnValue: T | Promise<T>, iterable: Iterable<unknown>): T | Promise<T> {
            const iterator: Iterator<unknown> = iterable[Symbol.iterator]();
            let result: IteratorResult<unknown>;
            return complete(returnValue);

            function complete<T>(returnValue: T | Promise<T>): T | Promise<T> {
                if (returnValue && "then" in returnValue) {
                    return completeAsync(returnValue, result.value);
                }
                do {
                    result = iterator.next();
                    if (result.value && "then" in result.value) {
                        return completeAsync(returnValue, result.value);
                    }
                    if (transition.signal.aborted) {
                        break; // Handled elsewhere
                    }
                } while (!result.done);
                return returnValue;
            }

            async function completeAsync<T>(returnValue: T | Promise<T>, value: Promise<unknown>): Promise<T> {
                if (returnValue && "then" in returnValue) {
                    return completeAsync(await returnValue, result.value);
                }
                await value;
                return complete(returnValue);
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
            const event = createEvent({
                type: "dispose",
                entry: known
            });
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

function getPerformance(): {
    now(): number;
    measure(name: string, start: string, finish: string): unknown;
    mark(mark: string): unknown;
} {
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
