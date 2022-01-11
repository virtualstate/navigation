import {AppHistory, AppHistoryResult} from "./spec/app-history";

export interface AppHistoryLocationOptions {
    appHistory: AppHistory;
    initialUrl?: URL | string;
}

type WritableURLKey =
    | "hash"
    | "host"
    | "hostname"
    | "href"
    | "pathname"
    | "port"
    | "protocol"
    | "search"

export const AppLocationCheckChange = Symbol.for("@virtualstate/app-history/location/checkChange");
export const AppLocationAwaitFinished = Symbol.for("@virtualstate/app-history/location/awaitFinished");
export const AppLocationTransitionURL = Symbol.for("@virtualstate/app-history/location/transitionURL");

export interface AppHistoryLocation extends Location {

}

const baseUrl = "https://html.spec.whatwg.org/";

/**
 * @experimental
 */
export class AppHistoryLocation implements Location {

    readonly #options: AppHistoryLocationOptions;
    readonly #appHistory: AppHistory;

    constructor(options: AppHistoryLocationOptions) {
        this.#options = options;
        this.#appHistory = options.appHistory;
    }

    readonly ancestorOrigins: DOMStringList;

    #urls = new WeakMap<object, URL>();

    #transitioningURL: URL | undefined;

    #initialURL: URL | undefined;

    get #url() {
        if (this.#transitioningURL) {
            return this.#transitioningURL;
        }
        const { current } = this.#appHistory;
        if (!current) {
            const initialUrl = this.#options.initialUrl ?? "/";
            this.#initialURL = typeof initialUrl === "string" ? new URL(initialUrl, baseUrl) : initialUrl;
            return this.#initialURL;
        }
        const existing = this.#urls.get(current);
        if (existing) return existing;
        const next = new URL(current.url, baseUrl);
        this.#urls.set(current, next);
        return next;
    }

    get hash() {
        return this.#url.hash;
    }

    set hash(value) {
        this.#setUrlValue("hash", value);
    }

    get host() {
        return this.#url.host;
    }

    set host(value) {
        this.#setUrlValue("host", value);
    }

    get hostname() {
        return this.#url.hostname;
    }

    set hostname(value) {
        this.#setUrlValue("hostname", value);
    }

    get href() {
        return this.#url.href;
    }

    set href(value) {
        this.#setUrlValue("href", value);
    }

    get origin() {
        return this.#url.origin;
    }

    get pathname() {
        return this.#url.pathname;
    }

    set pathname(value) {
        this.#setUrlValue("pathname", value);
    }

    get port() {
        return this.#url.port;
    }

    set port(value) {
        this.#setUrlValue("port", value);
    }

    get protocol() {
        return this.#url.protocol;
    }

    set protocol(value) {
        this.#setUrlValue("protocol", value);
    }

    get search() {
        return this.#url.search;
    }

    set search(value) {
        this.#setUrlValue("search", value);
    }

    #setUrlValue = (key: WritableURLKey, value: string) => {
        const currentUrlString = (this.#url ?? "").toString();
        const nextUrl = new URL(currentUrlString, "https://html.spec.whatwg.org/");
        nextUrl[key] = value;
        const nextUrlString = nextUrl.toString();
        if (currentUrlString === nextUrlString) {
            return;
        }
        void this.#transitionURL(
            nextUrl,
            () => this.#appHistory.navigate(nextUrlString)
        );
    }

    replace(url: string | URL): Promise<void>
    replace(url: string | URL): void
    async replace(url: string | URL): Promise<void> {
        return this.#transitionURL(
            url,
            (url) => this.#appHistory.navigate(url.toString(), {
                replace: true
            })
        );
    }

    reload(): Promise<void>
    reload(): void
    async reload(): Promise<void> {
        return this.#awaitFinished(this.#appHistory.reload());
    }

    assign(url: string | URL): Promise<void>
    assign(url: string | URL): void
    async assign(url: string | URL): Promise<void> {
        await this.#transitionURL(
            url,
            (url) => this.#appHistory.navigate(url.toString())
        )
    }

    protected [AppLocationTransitionURL](url: URL | string, fn: (url: URL) => AppHistoryResult) {
        return this.#transitionURL(url, fn);
    }

    #transitionURL = async (url: URL | string, fn: (url: URL) => AppHistoryResult) => {
        const instance = this.#transitioningURL = typeof url === "string" ? new URL(url, this.#url.toString()) : url;
        try {
            await this.#awaitFinished(fn(instance));
        } finally {
            if (this.#transitioningURL === instance) {
                this.#transitioningURL = undefined;
            }
        }
    }

    protected [AppLocationAwaitFinished](result: AppHistoryResult) {
        return this.#awaitFinished(result);
    }

    #awaitFinished = async (result?: AppHistoryResult) => {
        this.#initialURL = undefined;
        if (!result) return;
        const { committed, finished } = result;
        await Promise.all([committed, finished]);
    }

    #triggerIfUrlChanged = () => {
        const current = this.#url;
        const currentUrl = current.toString();
        const expectedUrl = this.#appHistory.current.url;
        if (currentUrl !== expectedUrl) {
            return this.#transitionURL(
                current,
                () => this.#appHistory.navigate(currentUrl)
            );
        }
    }

    /**
     * This is needed if you have changed searchParams using its mutating methods
     *
     * TODO replace get searchParams with an observable change to auto trigger this function
     */
    [AppLocationCheckChange]() {
        return this.#triggerIfUrlChanged();
    }

}