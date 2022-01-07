import {AppHistory, AppHistoryResult} from "./spec/app-history";

export interface AppHistoryOptions {
    appHistory: AppHistory;
}

export class AppAppHistory<S extends object> implements History {

    readonly #options: AppHistoryOptions;
    readonly #appHistory: AppHistory;

    constructor(options: AppHistoryOptions) {
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
        return this.#awaitFinished(this.#appHistory.back());
    }

    forward(): Promise<void>
    forward(): void
    async forward(): Promise<void> {
        return this.#awaitFinished(this.#appHistory.forward());
    }

    go(delta?: number): Promise<void>
    go(delta?: number): void
    async go(delta?: number): Promise<void> {
        if (typeof delta !== "number" || delta === 0 || isNaN(delta)) {
            return this.#awaitFinished(this.#appHistory.reload());
        }
        const entries = this.#appHistory.entries();
        const { current: { index } } = this.#appHistory;
        const nextIndex = index + delta;
        const nextEntry = entries[nextIndex];
        if (!nextEntry) {
            throw new Error(`Could not go ${delta}`);
        }
        const nextEntryKey = nextEntry.key;
        return this.#awaitFinished(this.#appHistory.goTo(nextEntryKey));
    }

    replaceState(data: any, unused: string, url?: string | URL | null): Promise<void>
    replaceState(data: any, unused: string, url?: string | URL | null): void
    async replaceState(data: any, unused: string, url?: string | URL | null): Promise<void> {
        if (url) {
            return this.#awaitFinished(this.#appHistory.navigate(url.toString(), {
                state: data,
                replace: true
            }));
        } else {
            return this.#appHistory.updateCurrent({
                state: data
            });
        }
    }

    #awaitFinished = async ({ committed, finished }: AppHistoryResult) => {
        await Promise.all([committed, finished]);
    }

    pushState(data: object, unused: string, url?: string | URL | null): Promise<void>;
    pushState(data: unknown, unused: string, url?: string | URL): Promise<void>;
    pushState(data: object, unused: string, url?: string | URL | null): void;
    pushState(data: unknown, unused: string, url?: string | URL): void;
    async pushState(data: object, unused: string, url?: string | URL | null): Promise<void> {
        if (url) {
            return this.#awaitFinished(this.#appHistory.navigate(url.toString(), {
                state: data
            }));
        } else {
            return this.#appHistory.updateCurrent({
                state: data
            });
        }
    }

}