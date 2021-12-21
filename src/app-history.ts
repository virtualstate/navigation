import {
    AppHistoryEntry,
    AppHistoryEntryInit,
    AppHistoryEntryKeyedState,
    AppHistoryEntryNavigationType
} from "./app-history-entry";
import {
    AppHistory as AppHistoryPrototype, AppHistoryCurrentChangeEvent, AppHistoryDestination,
    AppHistoryEventMap, AppHistoryNavigateEvent,
    AppHistoryNavigateOptions,
    AppHistoryNavigationOptions, AppHistoryNavigationType, AppHistoryReloadOptions,
    AppHistoryResult, AppHistoryTransitionInit, AppHistoryUpdateCurrentOptions, AppHistoryTransition as AppHistoryTransitionPrototype
} from "./app-history.prototype";
import {AppHistoryEventTarget} from "./app-history-event-target";
import {AppHistoryAbortError, AppRollbackError, InvalidStateError} from "./app-history-errors";
import {WritableProps} from "./writable";
import {EventTargetListeners} from "@opennetwork/environment";
import {AbortController} from "abort-controller";
import {AppHistoryTransition} from "./app-history-transition";
import exp from "constants";

export * from "./app-history.prototype";

const UpdateCurrent = Symbol.for("@virtualstate/app-history/updateCurrent");
const Rollback = Symbol.for("@virtualstate/app-history/rollback");

type InternalAppHistoryNavigationType =
    | AppHistoryNavigationType
    | typeof Rollback
    | typeof UpdateCurrent;

export interface InternalAppHistoryNavigateOptions extends AppHistoryNavigateOptions {
    entries?: AppHistoryEntry[];
    index?: number;
    navigationType?: AppHistoryNavigationType;
}

export class AppHistory extends AppHistoryEventTarget<AppHistoryEventMap> implements AppHistoryPrototype {

    #entries: AppHistoryEntry[] = [];
    #known = new Set<AppHistoryEntry>();
    #currentIndex = -1;
    #activePromise?: Promise<unknown | void>;
    #activeTransition?: AppHistoryTransition;
    #keyedState = new Map<string, unknown>();

    get canGoBack() {
        if (this.#currentIndex === 0) {
            return false;
        }
        const previous = this.#entries[this.#currentIndex - 1];
        return !!previous;
    };

    get canGoForward() {
        if (this.#currentIndex === -1) {
            return false;
        }
        if (this.#currentIndex === this.#entries.length - 1) {
            return false;
        }
        const next = this.#entries[this.#currentIndex + 1];
        return !!next;
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
            [AppHistoryEntryKeyedState]: this.#keyedState,
            url,
            ...options,
            navigationType,
        });
        return this.#pushEntry(
            navigationType,
            entry,
            options
        );
    }

    #cloneAppHistoryEntry = (entry: AppHistoryEntry, options?: InternalAppHistoryNavigateOptions): AppHistoryEntry => {
        return this.#createAppHistoryEntry({
            ...entry,
            [AppHistoryEntryKeyedState]: this.#keyedState,
            index: entry.index,
            state: options.state ?? entry.getState(),
            navigationType: entry[AppHistoryEntryNavigationType],
            ...options,
            get [EventTargetListeners]() {
                return entry[EventTargetListeners]
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

    #pushEntry = (navigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry, options?: InternalAppHistoryNavigateOptions) => {
        if (entry === this.current) throw new InvalidStateError();
        const existingPosition = this.#entries.findIndex(existing => existing.id === entry.id);
        if (existingPosition > -1) {
            throw new InvalidStateError();
        }
        return this.#commitTransition(navigationType, entry, options);
    };

    #commitTransition = (givenNavigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry, options?: InternalAppHistoryNavigateOptions) => {
        const activePromise = this.#activePromise ?? Promise.resolve();
        const finished: Promise<AppHistoryEntry> = activePromise
            .catch((error) => void error) // Catch somewhere else please
            .then(async () => {
                return await this.#immediateTransition(givenNavigationType, entry, finished, options);
            });
        this.#activePromise = finished;
        return { committed: Promise.resolve(entry), finished };
    }

    #immediateTransition = async (givenNavigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry, finished: Promise<AppHistoryEntry>, options?: InternalAppHistoryNavigateOptions) => {
        const transition: AppHistoryTransitionInit = {
            get finished() {
                return finished;
            },
            from: entry,
            navigationType: options?.navigationType ?? (
                typeof givenNavigationType === "string" ? givenNavigationType : undefined
            ) ?? "replace"
        };
        return this.#transition(givenNavigationType, entry, transition, options);
    }

    #transition = async (givenNavigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry, transition: AppHistoryTransitionInit, options?: InternalAppHistoryNavigateOptions) => {
        let navigationType = givenNavigationType;

        const performance = await getPerformance();
        const startTime = performance.now();

        if (entry.sameDocument && typeof navigationType === "string") {
            performance.mark(`same-document-navigation:${entry.id}`);
        }

        const previousEntries = [...this.#entries];
        const previousIndex = this.#currentIndex;

        const { current } = this;

        const abortController = new AbortController();
        const signal = abortController.signal;

        const promises: Promise<unknown>[] = [];

        let currentTransitionPromise: Promise<AppHistoryEntry>;

        const currentTransition = new AppHistoryTransition({
            ...transition,
            rollback: (options?: AppHistoryNavigationOptions) => {
                const entry = this.#cloneAppHistoryEntry(current, options);
                // console.log({ entry, t: entry[AppHistoryEntryNavigationType] });
                const { committed, finished } = this.#pushEntry(Rollback, entry, {
                    ...options,
                    index: previousIndex,
                    navigationType: entry[AppHistoryEntryNavigationType],
                    entries: previousEntries,
                });
                return {
                    committed: committed
                        .then(async (entry) => {
                           abortController.abort();
                           return entry;
                        }),
                    finished
                }
            },
            then: async (resolve, reject) => {
                await currentTransitionPromise?.catch(error => void error);
                // If there is any additional transition happening, wait for it to resolve
                if (this.transition) {
                    await this.transition;
                }
                while (this.#activePromise) {
                    await this.#activePromise.catch(error => void error);
                }
                return Promise.resolve(this.current).then(resolve, reject);
            }
        });

        const getResolvedIndex = () => {
            let resolvedNextIndex = this.#currentIndex + 1;
            if (navigationType === Rollback || navigationType === UpdateCurrent) {
                resolvedNextIndex = options.index;
            } else if (navigationType === "traverse" || navigationType === "reload") {
                resolvedNextIndex = entry.index;
            } else if (navigationType === "replace" && this.#currentIndex !== -1) {
                resolvedNextIndex = this.#currentIndex;
            } else if (navigationType === "replace") {
                navigationType = "push";
            }

            if (typeof resolvedNextIndex !== "number") {
                throw new InvalidStateError("Could not resolve next index");
            }

            return resolvedNextIndex;
        }

        const completeTransition = async () => {

            const isCurrentTransition = () => (
                navigationType !== UpdateCurrent ||
                (
                    !this.#activeTransition ||
                    this.#activeTransition.from.key === currentTransition.from.key
                )
            );
            const isCurrentAndEntrySameDocument = entry.sameDocument && (!current || current.sameDocument);

            // TODO WARN this is a difference from what is described here:
            //
            // https://github.com/WICG/app-history/blob/7c0332b30746b14863f717404402bc49e497a2b2/README.md?plain=1#L968
            //
            // Documented the transition is set at a later stage for non same document listeners,
            // however in this implementation same document events can access the final transition
            // non same document entries are set later stage
            //
            // However in this implementation, each time we reach here, we already "own" the scope of the
            // AppHistory instance, and are freely mutating its state. This is the only function we should be mutating
            //
            // This is to allow all event handlers within transitionWhile to invoke appHistory.transition.rollback
            // in a consistent way
            //
            // e.g.
            //
            // appHistory.addEventListener("navigateto", () => appHistory.transition.rollback().finished)
            // appHistory.addEventListener("navigatefrom", () => appHistory.transition.rollback().finished)
            // appHistory.addEventListener("navigateerror", () => appHistory.transition.rollback().finished)
            // appHistory.addEventListener("navigate", () => appHistory.transition.rollback().finished)
            // appHistory.addEventListener("currentchange", () => appHistory.transition.rollback().finished)
            //
            // If this is later on only currentchange, navigatefrom, and navigateerror, have access to the transition.
            //
            // They could alternatively wait for a matching currentchange event that has the matching destination
            // and state
            if (isCurrentAndEntrySameDocument && isCurrentTransition()) {
                this.#activeTransition = currentTransition;
            }

            const resolvedNextIndex = getResolvedIndex();
            const destination: WritableProps<AppHistoryDestination> = {
                url: entry.url,
                key: entry.key,
                index: resolvedNextIndex,
                sameDocument: entry.sameDocument,
                getState() {
                    return entry.getState()
                }
            };

            console.log({ navigationType, entry, options, destination, destinationState: destination.getState() });
            if (typeof navigationType === "string" || navigationType === Rollback) {
                await current?.dispatchEvent({
                    type: "navigatefrom",
                    destination
                });
            }
            let movedOn = false;

            const navigate: AppHistoryNavigateEvent = {
                signal,
                info: undefined,
                ...options,
                canTransition: true,
                formData: undefined,
                hashChange: false,
                navigationType: options?.navigationType ?? (
                    typeof navigationType === "string" ? navigationType : "replace"
                ),
                userInitiated: false,
                destination,
                preventDefault() {
                    abortController.abort();
                },
                transitionWhile(newNavigationAction: Promise<unknown>): void {
                    if (movedOn) {
                        throw new InvalidStateError("Event has already finished processing");
                    }
                    promises.push(newNavigationAction);
                },
                type: "navigate"
            }

            if (typeof navigationType === "string") {
                await this.dispatchEvent(navigate);
            }
            if (signal.aborted) {
                throw new AppHistoryAbortError();
            }
            const currentChange: AppHistoryCurrentChangeEvent = {
                from: current,
                type: "currentchange",
                navigationType: navigate.navigationType,
                startTime,
                transitionWhile: navigate.transitionWhile
            };

            // Clear keyed state
            // this.#keyedState.delete(entry.key);

            if (navigationType === UpdateCurrent) {
                console.log("Updating current!", { entry, previousState: current?.getState(), currentState: entry.getState() })
                this.#entries[destination.index] = entry;
            } else if (navigationType === Rollback) {
                const { entries, index: expectedIndex } = options;
                if (!entries) throw new InvalidStateError("Expected entries to be provided for rollback");
                if (typeof expectedIndex !== "number") throw new InvalidStateError("Expected index to be provided for rollback");
                this.#entries = entries;
                entries.forEach(entry => this.#known.add(entry));
                this.#currentIndex = expectedIndex;
            } else
                // Default next index is current entries length, aka
                // console.log({ navigationType, givenNavigationType, index: this.#currentIndex, resolvedNextIndex });
            if (navigationType === "replace" || navigationType === "traverse" || navigationType === "reload") {
                this.#entries[destination.index] = entry;
                if (navigationType === "replace") {
                    this.#entries = this.#entries.slice(0, destination.index + 1);
                }
            } else if (navigationType === "push") {
                // Trim forward, we have reset our stack
                if (this.#entries[destination.index]) {
                    // const before = [...this.#entries];
                    this.#entries = this.#entries.slice(0, destination.index);
                    // console.log({ before, after: [...this.#entries]})
                }
                this.#entries.push(entry);
            }

            // Sync forceful state for any entry that utilises this key from this moment forward
            // this.#keyedState.set(entry.key, entry.getState());

            this.#known.add(entry);

            console.log({ after: entry.getState() });

            // console.log(this.#entries);

            // UpdateCurrent acts on the state that was active at the time of calling
            // It should not mutate the current index
            if (navigationType !== UpdateCurrent) {
                this.#currentIndex = destination.index;
            }

            if (!isCurrentAndEntrySameDocument && isCurrentTransition()) {
                this.#activeTransition = currentTransition;
            }

            if (entry.sameDocument) {
                await this.dispatchEvent(currentChange);
            }
            if (typeof navigationType === "string") {
                await entry.dispatchEvent({
                    type: "navigateto",
                    destination
                });
            }
            await this.#dispose();
            if (!promises.length) {
                await new Promise<void>(queueMicrotask);
            }
            if (promises.length) {
                await Promise.all(promises);
            }
            movedOn = true;
            if (typeof navigationType === "string") {
                await entry.dispatchEvent({
                    type: "finish"
                });
            }
            assertNotAbortedAfterTransitioned(signal);
            if (typeof navigationType === "string") {
                await this.dispatchEvent({
                    type: "navigatesuccess",
                    destination
                });
            }
            assertNotAbortedAfterTransitioned(signal);
            return entry;
        };

        try {
            return await (
                currentTransitionPromise = completeTransition()
            );
        } catch (error) {
            await Promise.allSettled(promises);

            if (!(error instanceof InvalidStateError || error instanceof AppHistoryAbortError) && (typeof navigationType === "string" || navigationType === Rollback)) {
                await this.dispatchEvent({
                    type: "navigateerror",
                    error,
                    get message() {
                        if (error instanceof Error) {
                            return error.message;
                        }
                        return `${error}`;
                    }
                });
            }
            if (error instanceof AppHistoryAbortError) {
                if (this.transition) {
                    const { entry, error } = await Promise.resolve(this.transition)
                        .then((entry): { entry: typeof entry, error: unknown } => ({ entry, error: undefined }))
                        .catch((error): { entry: undefined, error: unknown } => ({ error, entry: undefined }));

                    // If there is an error, reject later on with our original error instead
                    //
                    // Else, if we got an entry, we have an entry that we can return instead!
                    //
                    // TODO WARN this may not be expected behaviour
                    if (!error && entry) {

                    }
                }
            }
            throw await Promise.reject(error);
        } finally {
            await Promise.allSettled(promises);

            if (this.#activeTransition === currentTransition) {
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

        function assertNotAbortedAfterTransitioned(signal: { aborted: boolean }): asserts signal is { aborted: false } {
            if (signal.aborted) {
                throw new InvalidStateError("Aborted after all provided transitionWhile promises complete");
            }
        }
    }

    #dispose = async () => {
        for (const known of this.#known) {
            const index = this.#entries.findIndex(entry => entry.id === known.id);
            if (index !== -1) {
                // Still in use
                continue;
            }
            // No index, no longer known
            this.#known.delete(known);
            await known.dispatchEvent({
                type: "dispose"
            });
        }
    }

    reload(options?: AppHistoryReloadOptions): AppHistoryResult {
        const { current } = this;
        if (!current) throw new InvalidStateError();
        const entry = this.#cloneAppHistoryEntry(current, options);
        return this.#pushEntry("reload", entry, options);
    }

    updateCurrent(options: AppHistoryUpdateCurrentOptions): AppHistoryResult
    updateCurrent(options: AppHistoryUpdateCurrentOptions): void
    updateCurrent(options: AppHistoryUpdateCurrentOptions): AppHistoryResult {
        const { current } = this;
        console.log({ updating: current, state: current.getState() })
        const entry = this.#cloneAppHistoryEntry(current, options);
        return this.#pushEntry(UpdateCurrent, entry, {
            ...options,
            index: current.index
        });
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
    const { performance: nodePerformance } = await import("perf_hooks");
    return nodePerformance;
}