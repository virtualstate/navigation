import {AppHistoryEntry, AppHistoryEntryInit, AppHistoryEntryNavigationType} from "./app-history-entry";
import {
    AppHistory as AppHistoryPrototype, AppHistoryCurrentChangeEvent, AppHistoryDestination,
    AppHistoryEventMap, AppHistoryNavigateEvent,
    AppHistoryNavigateOptions,
    AppHistoryNavigationOptions, AppHistoryNavigationType, AppHistoryReloadOptions,
    AppHistoryResult, AppHistoryTransitionInit, AppHistoryUpdateCurrentOptions, AppHistoryTransition as AppHistoryTransitionPrototype
} from "./app-history.prototype";
import {AppHistoryEventTarget} from "./app-history-event-target";
import {InvalidStateError} from "./app-history-errors";
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
        if (this.#currentIndex === -1) throw new Error("Cannot go back");
        const entry = this.#entries[this.#currentIndex - 1];
        if (!entry) throw new Error("Cannot go back");
        return this.#pushEntry("traverse", this.#cloneAppHistoryEntry(entry, {
            ...options,
            navigationType: "traverse"
        }));
    }

    entries(): AppHistoryEntry[] {
        return [...this.#entries];
    }

    forward(options?: AppHistoryNavigationOptions): AppHistoryResult {
        if (this.#currentIndex === -1) throw new InvalidStateError();
        const entry = this.#entries[this.#currentIndex + 1];
        if (!entry) throw new InvalidStateError();
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
            options
        );
    }

    #cloneAppHistoryEntry = (entry: AppHistoryEntry, options?: InternalAppHistoryNavigateOptions): AppHistoryEntry => {
        return this.#createAppHistoryEntry({
            ...entry,
            index: entry.index,
            state: entry.getState(),
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
        const finished: Promise<AppHistoryEntry> = (this.#activePromise = this.#activePromise ?? Promise.resolve())
            .catch((error) => void error) // Catch somewhere else please
            .then(async () => {
                return this.#immediateTransition(givenNavigationType, entry, options).finished;
            });
        return { committed: Promise.resolve(entry), finished };
    }

    #immediateTransition = (givenNavigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry, options?: InternalAppHistoryNavigateOptions) => {
        const finished: Promise<AppHistoryEntry> = (this.#activePromise = this.#activePromise ?? Promise.resolve())
            .catch((error) => void error) // Catch somewhere else please
            .then(async () => {
                const transition: AppHistoryTransitionInit = {
                    get finished() {
                        return finished;
                    },
                    from: entry,
                    navigationType: typeof givenNavigationType === "string" ? givenNavigationType : "replace"
                };
                return this.#transition(givenNavigationType, entry, transition, options);
            });
        return { committed: Promise.resolve(entry), finished };
    }

    #transition = async (givenNavigationType: InternalAppHistoryNavigationType, entry: AppHistoryEntry, transition: AppHistoryTransitionInit, options?: InternalAppHistoryNavigateOptions) => {
        let navigationType = givenNavigationType;

        const performance = await getPerformance();
        const startTime = performance.now();

        if (entry.sameDocument && typeof navigationType === "string") {
            performance.mark(`same-document-navigation:${entry.id}`);
        }

        let currentTransition: AppHistoryTransition;

        try {

            const abortController = new AbortController();

            const signal = abortController.signal;

            const { current } = this;

            let resolvedNextIndex = this.#currentIndex + 1;
            if (navigationType === Rollback) {
                resolvedNextIndex = options.index;
            } else if (navigationType === "traverse" || navigationType === "reload") {
                resolvedNextIndex = entry.index;
            } else if ((navigationType === "replace" || navigationType === UpdateCurrent) && this.#currentIndex !== -1) {
                resolvedNextIndex = this.#currentIndex;
            } else if (navigationType === "replace") {
                navigationType = "push";
            }

            if (typeof resolvedNextIndex !== "number") {
                throw new InvalidStateError("Could not resolve next index");
            }

            // console.log({ navigationType, entry, options });
            if (typeof navigationType === "string" || navigationType === Rollback) {
                await current?.dispatchEvent({
                    type: "navigatefrom"
                });
            }
            let promises: Promise<unknown>[] = [];
            let movedOn = false;

            const destination: WritableProps<AppHistoryDestination> = {
                url: entry.url,
                key: entry.key,
                index: resolvedNextIndex,
                sameDocument: entry.sameDocument,
                getState() {
                    return entry.getState()
                }
            };

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
                        throw new Error("Event has already finished processing");
                    }
                    promises.push(newNavigationAction);
                },
                type: "navigate"
            }
            if (typeof navigationType === "string") {
                await this.dispatchEvent(navigate);
            }
            if (signal.aborted) {
                return;
            }
            const currentChange: AppHistoryCurrentChangeEvent = {
                from: current,
                type: "currentchange",
                navigationType: navigate.navigationType,
                startTime,
                transitionWhile: navigate.transitionWhile
            };
            const previousEntries = [...this.#entries];
            if (navigationType === Rollback) {
                const { entries, index: expectedIndex } = options;
                if (!entries) throw new InvalidStateError("Expected entries to be provided for rollback");
                if (typeof expectedIndex !== "number") throw new InvalidStateError("Expected index to be provided for rollback");
                this.#entries = entries;
                entries.forEach(entry => this.#known.add(entry));
                this.#currentIndex = expectedIndex;
            } else
            // Default next index is current entries length, aka
            // console.log({ navigationType, givenNavigationType, index: this.#currentIndex, resolvedNextIndex });
            if (navigationType === UpdateCurrent || navigationType === "replace" || navigationType === "traverse" || navigationType === "reload") {
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
            this.#known.add(entry);

            // console.log(this.#entries);
            const previousIndex = this.#currentIndex;
            this.#currentIndex = destination.index;

            if (typeof navigationType === "string" || !this.#activeTransition) {
                currentTransition = this.#activeTransition = new AppHistoryTransition({
                    ...transition,
                    rollback: (options?: AppHistoryNavigationOptions) => {
                        const entry = this.#cloneAppHistoryEntry(current, options);
                        return this.#pushEntry(Rollback, entry, {
                            ...options,
                            index: previousIndex,
                            navigationType: entry[AppHistoryEntryNavigationType],
                            entries: previousEntries,
                        });
                    }
                });
            }

            if (entry.sameDocument) {
                await this.dispatchEvent(currentChange);
            }
            if (typeof navigationType === "string") {
                await entry.dispatchEvent({
                    type: "navigateto"
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
                    type: "navigatesuccess"
                });
            }
            assertNotAbortedAfterTransitioned(signal);
            return entry;
        } catch (error) {
            if (!(error instanceof InvalidStateError) && (typeof navigationType === "string" || navigationType === Rollback)) {
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
            await Promise.reject(error);
            throw error;
        } finally {
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
        const entry = this.#cloneAppHistoryEntry(current, options);
        return this.#pushEntry(UpdateCurrent, entry, options);
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