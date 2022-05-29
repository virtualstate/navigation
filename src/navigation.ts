import {
    NavigationHistoryEntry,
    NavigationHistoryEntryInit,
    NavigationHistoryEntryKnownAs,
    NavigationHistoryEntryNavigationType, NavigationHistoryEntrySetState
} from "./navigation-entry";
import {
    Navigation as NavigationPrototype,
    NavigationEventMap,
    NavigationReloadOptions,
    NavigationResult,
    NavigationUpdateCurrentOptions,
    NavigationTransition as NavigationTransitionPrototype, NavigationCurrentEntryChangeEvent, NavigationNavigationOptions
} from "./spec/navigation";
import {NavigationEventTarget} from "./navigation-event-target";
import {InvalidStateError} from "./navigation-errors";
import {EventTargetListeners} from "./event-target";
import {
    NavigationTransition,
    NavigationTransitionEntry,
    NavigationTransitionError,
    NavigationTransitionFinally,
    NavigationTransitionStart,
    NavigationTransitionInitialEntries,
    NavigationTransitionInitialIndex,
    NavigationTransitionKnown,
    NavigationTransitionNavigationType,
    NavigationTransitionParentEventTarget,
    NavigationTransitionPromises,
    NavigationTransitionWait,
    InternalNavigationNavigationType,
    Rollback,
    Unset,
    NavigationTransitionWhile,
    NavigationTransitionStartDeadline,
    NavigationTransitionCommit,
    NavigationTransitionFinish,
    NavigationTransitionAbort,
    NavigationTransitionIsOngoing,
    NavigationTransitionFinishedDeferred, NavigationTransitionCommittedDeferred, NavigationTransitionIsPending
} from "./navigation-transition";
import {
    NavigationTransitionResult,
    createNavigationTransition, EventAbortController,
    InternalNavigationNavigateOptions,
    NavigationNavigateOptions
} from "./create-navigation-transition";
import {createEvent} from "./event-target/create-event";

export * from "./spec/navigation";

export interface NavigationOptions {
    initialUrl?: URL | string;
}

const baseUrl = "https://html.spec.whatwg.org/";

export class Navigation extends NavigationEventTarget<NavigationEventMap> implements NavigationPrototype {

    // Should be always 0 or 1
    #transitionInProgressCount = 0;

    #entries: NavigationHistoryEntry[] = [];
    #known = new Set<NavigationHistoryEntry>();
    #currentIndex = -1;
    #activePromise?: Promise<unknown>;
    #activeTransition?: NavigationTransition;
    //
    // #upcomingNonTraverseTransition: NavigationTransition;

    #knownTransitions = new WeakSet();
    #initialUrl: string;

    get canGoBack() {
       return !!this.#entries[this.#currentIndex - 1];
    };

    get canGoForward() {
        return !!this.#entries[this.#currentIndex + 1];
    };

    get currentEntry() {
        if (this.#currentIndex === -1) {
            return undefined;
        }
        return this.#entries[this.#currentIndex];
    };

    get transition(): NavigationTransitionPrototype | undefined {
        const transition = this.#activeTransition;
        // Never let an aborted transition leak, it doesn't need to be accessed any more
        return transition?.signal.aborted ? undefined : transition;
    };

    constructor(options?: NavigationOptions) {
        super();
        const initialUrl = options?.initialUrl ?? "/";
        this.#initialUrl = (typeof initialUrl === "string" ? new URL(initialUrl, baseUrl) : initialUrl).toString();
    }

    back(options?: NavigationNavigationOptions): NavigationResult {
        if (!this.canGoBack) throw new InvalidStateError("Cannot go back");
        const entry = this.#entries[this.#currentIndex - 1];
        return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(entry, {
            ...options,
            navigationType: "traverse"
        }));
    }

    entries(): NavigationHistoryEntry[] {
        return [...this.#entries];
    }

    forward(options?: NavigationNavigationOptions): NavigationResult {
        if (!this.canGoForward) throw new InvalidStateError();
        const entry = this.#entries[this.#currentIndex + 1];
        return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(entry, {
            ...options,
            navigationType: "traverse"
        }));
    }

    goTo(key: string, options?: NavigationNavigationOptions): NavigationResult {
        const found = this.#entries.find(entry => entry.key === key);
        if (found) {
            return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(found, {
                ...options,
                navigationType: "traverse"
            }));
        }
        throw new InvalidStateError();
    }

    navigate(url: string, options?: NavigationNavigateOptions): NavigationResult {
        const nextUrl = new URL(url, this.#initialUrl).toString();
        // console.log({ nextUrl });
        const navigationType = options?.replace ? "replace" : "push";
        const entry = this.#createNavigationHistoryEntry({
            url: nextUrl,
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

    #cloneNavigationHistoryEntry = (entry?: NavigationHistoryEntry, options?: InternalNavigationNavigateOptions): NavigationHistoryEntry => {
        return this.#createNavigationHistoryEntry({
            ...entry,
            index: entry?.index ?? undefined,
            state: options?.state ?? entry?.getState() ?? {},
            navigationType: entry?.[NavigationHistoryEntryNavigationType] ?? (typeof options?.navigationType === "string" ? options.navigationType : "replace"),
            ...options,
            get [NavigationHistoryEntryKnownAs]() {
              return entry?.[NavigationHistoryEntryKnownAs];
            },
            get [EventTargetListeners]() {
                return entry?.[EventTargetListeners];
            }
        });
    }

    #createNavigationHistoryEntry = (options: Partial<NavigationHistoryEntryInit> & Omit<NavigationHistoryEntryInit, "index">) => {
        const entry: NavigationHistoryEntry = new NavigationHistoryEntry({
            ...options,
            index: options.index ?? (() => {
                return this.#entries.indexOf(entry);
            }),
        });
        return entry;

    }

    #pushEntry = (navigationType: InternalNavigationNavigationType, entry: NavigationHistoryEntry, transition?: NavigationTransition, options?: InternalNavigationNavigateOptions) => {
        /* c8 ignore start */
        if (entry === this.currentEntry) throw new InvalidStateError();
        const existingPosition = this.#entries.findIndex(existing => existing.id === entry.id);
        if (existingPosition > -1) {
            throw new InvalidStateError();
        }
        /* c8 ignore end */
        return this.#commitTransition(navigationType, entry, transition, options);
    };

    #commitTransition = (givenNavigationType: InternalNavigationNavigationType, entry: NavigationHistoryEntry,  transition?: NavigationTransition, options?: InternalNavigationNavigateOptions) => {
        const nextTransition: NavigationTransition = transition ?? new NavigationTransition({
            from: entry,
            navigationType: typeof givenNavigationType === "string" ? givenNavigationType : "replace",
            rollback: (options) => {
                return this.#rollback(nextTransition, options);
            },
            [NavigationTransitionNavigationType]: givenNavigationType,
            [NavigationTransitionInitialEntries]: [...this.#entries],
            [NavigationTransitionInitialIndex]: this.#currentIndex,
            [NavigationTransitionKnown]: [...this.#known],
            [NavigationTransitionEntry]: entry,
            [NavigationTransitionParentEventTarget]: this
        });
        const { finished, committed } = nextTransition;
        const handler = () => {
            return this.#immediateTransition(givenNavigationType, entry, nextTransition, options);
        };
        void handler().catch(error => void error);
        // const previousPromise = this.#activePromise;
        // let nextPromise;
        // // console.log({ givenNavigationType });
        // if (givenNavigationType === Rollback) {
        //     nextPromise = handler().then(() => previousPromise);
        // } else {
        //     if (previousPromise) {
        //         nextPromise = previousPromise.then(handler);
        //     } else {
        //         nextPromise = handler();
        //     }
        // }
        // console.log({ previousPromise, nextPromise });
        // const promise = nextPromise
        //     .catch(error => void error)
        //     .then(() => {
        //         if (this.#activePromise === promise) {
        //             this.#activePromise = undefined;
        //         }
        //     })
        this.#queueTransition(nextTransition);
        return { committed, finished };

    }

    #queueTransition = (transition: NavigationTransition) => {
        // TODO consume errors that are not abort errors
        // transition.finished.catch(error => void error);
        this.#knownTransitions.add(transition);
    }

    #immediateTransition = (givenNavigationType: InternalNavigationNavigationType, entry: NavigationHistoryEntry, transition: NavigationTransition, options?: InternalNavigationNavigateOptions) => {
        try {
            this.#transitionInProgressCount += 1;
            if (this.#transitionInProgressCount > 1 && !(givenNavigationType === Rollback)) {
                throw new InvalidStateError("Unexpected multiple transitions");
            }
            return this.#transition(givenNavigationType, entry, transition, options);
        } finally {
            this.#transitionInProgressCount -= 1;
        }
    }

    #rollback = (rollbackTransition: NavigationTransition, options?: NavigationNavigationOptions): NavigationResult => {
        const previousEntries = rollbackTransition[NavigationTransitionInitialEntries];
        const previousIndex = rollbackTransition[NavigationTransitionInitialIndex];
        const previousCurrent = previousEntries[previousIndex];
        // console.log("z");
        // console.log("Rollback!", { previousCurrent, previousEntries, previousIndex });
        const entry = previousCurrent ? this.#cloneNavigationHistoryEntry(previousCurrent, options) : undefined;
        const nextOptions: InternalNavigationNavigateOptions = {
            ...options,
            index: previousIndex,
            known: new Set([...this.#known, ...previousEntries]),
            navigationType: entry?.[NavigationHistoryEntryNavigationType] ?? "replace",
            entries: previousEntries,
        } as const;
        const resolvedNavigationType = entry ? Rollback : Unset
        const resolvedEntry = entry ?? this.#createNavigationHistoryEntry({
            navigationType: "replace",
            index: nextOptions.index,
            sameDocument: true,
            ...options,
        });
        return this.#pushEntry(resolvedNavigationType, resolvedEntry, undefined, nextOptions);
    }

    #transition = (givenNavigationType: InternalNavigationNavigationType, entry: NavigationHistoryEntry, transition: NavigationTransition, options?: InternalNavigationNavigateOptions): Promise<NavigationHistoryEntry> => {
        // console.log({ givenNavigationType, transition });
        let navigationType = givenNavigationType;

        const performance = getPerformance();

        if (entry.sameDocument && typeof navigationType === "string") {
            performance.mark(`same-document-navigation:${entry.id}`);
        }

        let committed = false;

        const { currentEntry } = this;
        void this.#activeTransition?.finished?.catch(error => error);
        void this.#activeTransition?.[NavigationTransitionFinishedDeferred]?.promise?.catch(error => error);
        void this.#activeTransition?.[NavigationTransitionCommittedDeferred]?.promise?.catch(error => error);
        this.#activeTransition?.[NavigationTransitionAbort]();
        this.#activeTransition = transition;

        const startEventPromise = transition.dispatchEvent({
            type: NavigationTransitionStart,
            transition,
            entry
        });

        const unsetTransition = async () => {
            await startEventPromise;
            if (!(typeof options?.index === "number" && options.entries)) throw new InvalidStateError();
            await asyncCommit({
                entries: options.entries,
                index: options.index,
                known: options.known,
            });
            await this.dispatchEvent(
                createEvent({
                    type: "currentchange"
                })
            );
            committed = true;
            return entry;
        }


        const completeTransition = (): Promise<NavigationHistoryEntry> => {
            if (givenNavigationType === Unset) {
                return unsetTransition();
            }
            
            const transitionResult = createNavigationTransition({
                currentEntry,
                currentIndex: this.#currentIndex,
                options,
                transition,
                known: this.#known
            });

            const microtask = new Promise<void>(queueMicrotask);
            let promises: Promise<unknown>[] = [];
            const iterator = transitionSteps(transitionResult)[Symbol.iterator]();
            const iterable = { [Symbol.iterator]: () => ({ next: () => iterator.next() })};

            function syncTransition() {
                for (const promise of iterable) {
                    if (promise && typeof promise === "object" && "then" in promise) {
                        promises.push(promise);
                        void promise.catch(error => error);
                    }
                    if (committed) {
                        return asyncTransition();
                    }
                    if (transition.signal.aborted) {
                        break;
                    }
                }
                return Promise.resolve(); // We got through with no async
            }
            async function asyncTransition(): Promise<void> {
                const captured = [...promises];
                if (captured.length) {
                    promises = [];
                    await Promise.all(captured);
                } else if (!transition[NavigationTransitionIsOngoing]) {
                    await microtask;
                }
                return syncTransition();
            }

            // console.log("Returning", { entry });
            return syncTransition()
                .then(() => transition[NavigationTransitionIsOngoing] ? undefined : microtask)
                .then(() => entry);
        }

        interface Commit  {
            entries: NavigationHistoryEntry[];
            index: number;
            known?: Set<NavigationHistoryEntry>;
        }

        const syncCommit = ({ entries, index, known }: Commit) => {
            if (transition.signal.aborted) return;
            this.#entries = entries;
            if (known) {
                this.#known = new Set([...this.#known, ...(known)])
            }
            this.#currentIndex = index;
        }

        const asyncCommit = (commit: Commit) => {
            syncCommit(commit);
            return transition.dispatchEvent(
                createEvent(
                    {
                        type: NavigationTransitionCommit,
                        transition,
                        entry
                    }
                )
            );
        }

        const dispose = async () => this.#dispose();

        function *transitionSteps(transitionResult: NavigationTransitionResult): Iterable<Promise<unknown>> {
            const microtask = new Promise<void>(queueMicrotask);
            const {
                known,
                entries,
                index,
                currentChange,
                navigate,
            } = transitionResult;

            const navigateAbort = navigate[EventAbortController].abort.bind(navigate[EventAbortController]);
            transition.signal.addEventListener("abort", navigateAbort, { once: true });

            if (typeof navigationType === "string" || navigationType === Rollback) {
                const promise = currentEntry?.dispatchEvent(
                    createEvent({
                        type: "navigatefrom",
                        transitionWhile: transition[NavigationTransitionWhile],
                    })
                );
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
            committed = true;
            if (typeof navigationType === "string") {
                yield entry.dispatchEvent(
                    createEvent({
                        type: "navigateto",
                        transitionWhile: transition[NavigationTransitionWhile],
                    })
                );
            }
            yield dispose();
            if (!transition[NavigationTransitionPromises].size) {
                yield microtask;
            }
            yield transition.dispatchEvent({
                type: NavigationTransitionStartDeadline,
                transition,
                entry
            });
            yield transition[NavigationTransitionWait]();
            transition.signal.removeEventListener("abort", navigateAbort);
            yield transition[NavigationTransitionFinish]();
            if (typeof navigationType === "string") {
                yield transition.dispatchEvent(
                    createEvent({
                        type: "finish",
                        transitionWhile: transition[NavigationTransitionWhile]
                    })
                );
                yield transition.dispatchEvent(
                    createEvent({
                        type: "navigatesuccess",
                        transitionWhile: transition[NavigationTransitionWhile]
                    })
                );
            }
            // If we have more length here, we have added more transition
            if (transition[NavigationTransitionIsPending]) {
                yield Promise.reject(new InvalidStateError("Unexpected pending promises after finish"));
            }
        }

        const maybeSyncTransition = () => {
            try {
                return completeTransition();
            } catch (error) {
                return Promise.reject(error);
            }
        }

        return Promise.allSettled([
            maybeSyncTransition()
        ])
            .then(async ([detail]) => {
                if (detail.status === "rejected") {
                    await transition.dispatchEvent({
                        type: NavigationTransitionError,
                        error: detail.reason,
                        transition,
                        entry
                    });
                }

                await dispose();
                await transition.dispatchEvent({
                    type: NavigationTransitionFinally,
                    transition,
                    entry
                });
                await transition[NavigationTransitionWait]();
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
            })
            .then(() => entry)
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

    reload(options?: NavigationReloadOptions): NavigationResult {
        const { currentEntry } = this;
        if (!currentEntry) throw new InvalidStateError();
        const entry = this.#cloneNavigationHistoryEntry(currentEntry, options);
        return this.#pushEntry("reload", entry, undefined, options);
    }

    updateCurrentEntry(options: NavigationUpdateCurrentOptions): Promise<void>
    updateCurrentEntry(options: NavigationUpdateCurrentOptions): void
    updateCurrentEntry(options: NavigationUpdateCurrentOptions): unknown {
        const { currentEntry } = this;

        if (!currentEntry) {
            throw new InvalidStateError("Expected current entry");
        }

        // Instant change
        currentEntry[NavigationHistoryEntrySetState](options.state);

        const currentChange: NavigationCurrentEntryChangeEvent = createEvent({
            from: currentEntry,
            type: "currentchange",
            navigationType: undefined,
        });

        return this.dispatchEvent(currentChange);
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
