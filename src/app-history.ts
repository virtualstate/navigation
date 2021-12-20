import { AppHistoryEntry } from "./app-history-entry";
import {
    AppHistory as AppHistoryPrototype, AppHistoryCurrentChangeEvent, AppHistoryDestination, AppHistoryEntryInit,
    AppHistoryEventMap, AppHistoryNavigateEvent,
    AppHistoryNavigateOptions,
    AppHistoryNavigationOptions, AppHistoryNavigationType, AppHistoryReloadOptions,
    AppHistoryResult,
    AppHistoryTransition, AppHistoryUpdateCurrentOptions
} from "./app-history.prototype";
import {AppHistoryEventTarget} from "./app-history-event-target";
import {InvalidStateError} from "./app-history-errors";
import {WritableProps} from "./writable";
import {EventTargetListeners} from "@opennetwork/environment";

export * from "./app-history.prototype";

export class AppHistory extends AppHistoryEventTarget<AppHistoryEventMap> implements AppHistoryPrototype {

    #entries: AppHistoryEntry[] = [];
    #currentIndex = -1;
    #transition?: AppHistoryTransition;

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

    get transition() {
        return this.#transition;
    };

    back(options?: AppHistoryNavigationOptions): AppHistoryResult {
        if (this.#currentIndex === -1) throw new Error("Cannot go back");
        const entry = this.#entries[this.#currentIndex - 1];
        if (!entry) throw new Error("Cannot go back");
        return this.#pushEntry("traverse", this.#cloneAppHistoryEntry(entry, options));
    }

    entries(): AppHistoryEntry[] {
        return [...this.#entries];
    }

    forward(options?: AppHistoryNavigationOptions): AppHistoryResult {
        if (this.#currentIndex === -1) throw new InvalidStateError();
        const entry = this.#entries[this.#currentIndex + 1];
        if (!entry) throw new InvalidStateError();
        return this.#pushEntry("traverse", this.#cloneAppHistoryEntry(entry, options));
    }

    goTo(key: string, options?: AppHistoryNavigationOptions): AppHistoryResult {
        const found = this.#entries.find(entry => entry.key === key);
        if (found) {
            return this.#pushEntry("push", this.#cloneAppHistoryEntry(found, options));
        }
        throw new InvalidStateError();
    }

    navigate(url: string, options?: AppHistoryNavigateOptions): AppHistoryResult {
        const entry = this.#createAppHistoryEntry({
            url,
            ...options
        });
        return this.#pushEntry(
            options?.replace ? "replace" : "push",
            entry,
            options
        );
    }

    #cloneAppHistoryEntry = (entry: AppHistoryEntry, options?: AppHistoryNavigateOptions): AppHistoryEntry => {
        return this.#createAppHistoryEntry({
            ...entry,
            index: entry.index,
            state: entry.getState(),
            ...options,
            get [EventTargetListeners]() {
                return entry[EventTargetListeners]
            }
        });
    }

    #createAppHistoryEntry = (options: Partial<AppHistoryEntryInit> & Omit<AppHistoryEntryInit, "index">) => {
        const entries = this.#entries;
        const entry: AppHistoryEntry = new AppHistoryEntry({
            index() {
                return entries.indexOf(entry);
            },
            ...options,
        });
        return entry;

    }

    #pushEntry = (navigationType: AppHistoryNavigationType, entry: AppHistoryEntry, options?: AppHistoryNavigateOptions) => {
        if (entry === this.current) throw new InvalidStateError();
        const existingPosition = this.#entries.findIndex(existing => existing.id === entry.id);
        if (existingPosition > -1) {
            throw new InvalidStateError();
        }
        const committed = Promise.resolve(entry);
        const finished = this.#processEntry(navigationType, entry, options);
        return { finished, committed };
    };

    #processEntry = async (givenNavigationType: AppHistoryNavigationType, entry: AppHistoryEntry, options?: AppHistoryNavigateOptions) => {
        let navigationType = givenNavigationType;

        const performance = await getPerformance();
        const startTime = performance.now();

        if (entry.sameDocument) {
            performance.mark(`same-document-navigation:${entry.id}`);
        }
        try {

            const { current } = this;

            let resolvedNextIndex = this.#currentIndex + 1;
            if (navigationType === "traverse" || navigationType === "reload") {
                resolvedNextIndex = entry.index;
            } else if (navigationType === "replace" && this.#currentIndex !== -1) {
                resolvedNextIndex = this.#currentIndex;
            } else if (navigationType === "replace") {
                navigationType = "push";
            }

            // console.log({ navigationType, entry, options });
            await current?.dispatchEvent({
                type: "navigatefrom"
            });
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
                signal: undefined,
                info: undefined,
                ...options,
                canTransition: true,
                formData: undefined,
                hashChange: false,
                navigationType,
                userInitiated: false,
                destination,
                transitionWhile(newNavigationAction: Promise<unknown>): void {
                    if (movedOn) {
                        throw new Error("Event has already finished processing");
                    }
                    promises.push(newNavigationAction);
                },
                type: "navigate"
            }
            await this.dispatchEvent(navigate);
            await Promise.all(promises);
            movedOn = true;
            const currentChange: AppHistoryCurrentChangeEvent = {
                from: this.current,
                type: "currentchange",
                navigationType,
                startTime
            }
            // Default next index is current entries length, aka
            // console.log({ navigationType, givenNavigationType, index: this.#currentIndex, resolvedNextIndex });
            if (navigationType === "replace" || navigationType === "traverse" || navigationType === "reload") {
                this.#entries[destination.index] = entry;
                if (navigationType === "replace") {
                    this.#entries = this.#entries.slice(0, destination.index + 1);
                }
            } else if (navigationType === "push") {
                // Trim forward, we have reset our stack
                if (this.#entries[destination.index + 1]) {
                    this.#entries = this.#entries.slice(0, destination.index + 1);
                }
                this.#entries.push(entry);
            }
            // console.log(this.#entries);
            this.#currentIndex = destination.index;
            if (entry.sameDocument) {
                await this.dispatchEvent(currentChange);
            }
            await entry.dispatchEvent({
                type: "navigateto"
            });
            await entry.dispatchEvent({
                type: "finish"
            });
            await this.dispatchEvent({
                type: "navigatesuccess"
            });
            return entry;
        } catch (error) {
            await this.dispatchEvent({
                type: "navigateerror",
                error
            });
            await Promise.reject(error);
            throw error;
        } finally {
            if (entry.sameDocument) {
                performance.mark(`same-document-navigation-finish:${entry.id}`);
                performance.measure(
                    `same-document-navigation:${entry.url}`,
                    `same-document-navigation:${entry.id}`,
                    `same-document-navigation-finish:${entry.id}`
                );
            }
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
        this.#entries[current.index] = entry;
        const currentChange: AppHistoryCurrentChangeEvent = {
            from: current,
            type: "currentchange",
            navigationType: undefined,
            startTime: undefined
        }
        const finished = Promise.resolve(this.dispatchEvent(currentChange)).then(() => entry);
        return { committed: Promise.resolve(entry), finished }
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