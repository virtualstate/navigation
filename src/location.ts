import {AppHistory, AppHistoryResult} from "./spec/app-history";

export interface AppLocationOptions {
    appHistory: AppHistory;
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

export class AppLocation implements Location {

    readonly #options: AppLocationOptions;
    readonly #appHistory: AppHistory;

    constructor(options: AppLocationOptions) {
        this.#options = options;
        this.#appHistory = options.appHistory;
    }

    readonly ancestorOrigins: DOMStringList;

    #urls = new WeakMap<object, URL>();

    #transitioningUrl: URL | undefined;

    get #url() {
        if (this.#transitioningUrl) {
            return this.#transitioningUrl;
        }
        const { current } = this.#appHistory;
        if (!current) return undefined;
        const existing = this.#urls.get(current);
        if (existing) return existing;
        const next = new URL(current.url);
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
        const currentUrlString = this.#url.toString();
        const nextUrl = new URL(currentUrlString);
        nextUrl[key] = value;
        const nextUrlString = nextUrl.toString();
        if (currentUrlString === nextUrlString) {
            return;
        }
        void this.#transitionUrl(
            nextUrl,
            () => this.#appHistory.navigate(nextUrlString)
        );
    }

    replace(url: string | URL): Promise<void>
    replace(url: string | URL): void
    async replace(url: string | URL): Promise<void> {
        const instance = new URL(url, this.#url.toString());
        return this.#transitionUrl(
            instance,
            () => this.#appHistory.navigate(instance.toString(), {
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
        const instance = new URL(url, this.#url.toString());
        await this.#transitionUrl(
            instance,
            () => this.#appHistory.navigate(instance.toString())
        )
    }

    #transitionUrl = async (url: URL, fn: () => AppHistoryResult) => {
        this.#transitioningUrl = url;
        try {
            await this.#awaitFinished(fn());
        } finally {
            if (this.#transitioningUrl === url) {
                this.#transitioningUrl = undefined;
            }
        }
    }

    #awaitFinished = async ({ committed, finished }: AppHistoryResult) => {
        await Promise.all([committed, finished]);
    }

    #triggerIfUrlChanged = () => {
        const current = this.#url;
        const currentUrl = current.toString();
        const expectedUrl = this.#appHistory.current.url;
        if (currentUrl !== expectedUrl) {
            return this.#transitionUrl(
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