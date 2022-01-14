import {AppHistory, AppHistoryResult} from "./spec/app-history";
import {
    AppHistoryLocation,
    AppHistoryLocationOptions,
    AppLocationAwaitFinished,
    AppLocationTransitionURL
} from "./location";
import {InvalidStateError} from "./app-history-errors";

export interface AppHistoryHistoryOptions extends AppHistoryLocationOptions {
    appHistory: AppHistory;
}

export interface AppHistoryHistory<S extends object> {

}

/**
 * @experimental
 */
export class AppHistoryHistory<S extends object>  extends AppHistoryLocation implements History {

    readonly #options: AppHistoryHistoryOptions;
    readonly #appHistory: AppHistory;

    constructor(options: AppHistoryHistoryOptions) {
        super(options);
        this.#options = options;
        this.#appHistory = options.appHistory;
    }

    get length() {
        return this.#appHistory.entries().length;
    }

    scrollRestoration: ScrollRestoration = "manual"

    get state(): S {
        return this.#appHistory.current.getState<S>();
    }

    back(): Promise<void>
    back(): void
    async back(): Promise<void> {
        const entries = this.#appHistory.entries();
        const index = this.#appHistory.current?.index ?? -1;
        const back = entries[index - 1];
        if (!back) throw new InvalidStateError("Cannot go back");
        return this[AppLocationTransitionURL](back.url, () => this.#appHistory.back());
    }

    forward(): Promise<void>
    forward(): void
    async forward(): Promise<void> {
        const entries = this.#appHistory.entries();
        const index = this.#appHistory.current?.index ?? -1;
        const forward = entries[index + 1];
        if (!forward) throw new InvalidStateError("Cannot go forward");
        return this[AppLocationTransitionURL](forward.url, () => this.#appHistory.forward());
    }

    go(delta?: number): Promise<void>
    go(delta?: number): void
    async go(delta?: number): Promise<void> {
        if (typeof delta !== "number" || delta === 0 || isNaN(delta)) {
            return this[AppLocationAwaitFinished](this.#appHistory.reload());
        }
        const entries = this.#appHistory.entries();
        const { current: { index } } = this.#appHistory;
        const nextIndex = index + delta;
        const nextEntry = entries[nextIndex];
        if (!nextEntry) {
            throw new Error(`Could not go ${delta}`);
        }
        const nextEntryKey = nextEntry.key;
        return this[AppLocationAwaitFinished](this.#appHistory.goTo(nextEntryKey));
    }

    replaceState(data: any, unused: string, url?: string | URL | null): Promise<void>
    replaceState(data: any, unused: string, url?: string | URL | null): void
    async replaceState(data: any, unused: string, url?: string | URL | null): Promise<void> {
        if (url) {
            return this[AppLocationTransitionURL](url, (url) => this.#appHistory.navigate(url.toString(), {
                state: data,
                replace: true
            }));
        } else {
            return this.#appHistory.updateCurrent({
                state: data
            });
        }
    }

    pushState(data: object, unused: string, url?: string | URL | null): Promise<void>;
    pushState(data: unknown, unused: string, url?: string | URL): Promise<void>;
    pushState(data: object, unused: string, url?: string | URL | null): void;
    pushState(data: unknown, unused: string, url?: string | URL): void;
    async pushState(data: object, unused: string, url?: string | URL | null): Promise<void> {
        if (url) {
            return this[AppLocationTransitionURL](url, (url) => this.#appHistory.navigate(url.toString(), {
                state: data
            }));
        } else {
            return this.#appHistory.updateCurrent({
                state: data
            });
        }
    }

}

/**
 * @experimental
 * @internal
 */
export class AppHistorySync<S extends object> extends AppHistoryHistory<S> implements AppHistoryHistory<S>, AppHistoryLocation {

}