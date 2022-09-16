import {NavigationNavigation} from "../navigation-navigation";
import {Navigation, NavigateEvent} from "../spec/navigation";
import {URLPattern} from "urlpattern-polyfill";
import {getNavigation} from "../get-navigation";
import {sign} from "crypto";

type NonNil<T> = T extends (null | undefined) ? never : T;
export type URLPatternResult = NonNil<ReturnType<URLPattern["exec"]>>

export interface RouteFn {
    (event: NavigateEvent, match: URLPatternResult): Promise<void | unknown> | unknown | void
}

interface Route {
    pattern: URLPattern;
    fn: RouteFn
}

const Routes = Symbol.for("@virtualstate/navigation/routes/routes");

const DEFAULT_BASE_URL = "https://html.spec.whatwg.org/";

export class Router extends NavigationNavigation {

    [Routes] = new Set<Route>();
    private listening = false;

    constructor(navigation: Navigation = getNavigation()) {
        super(navigation);
    }

    routes(router: Router): Router {
        for (const route of router[Routes]) {
            this[Routes].add(route);
        }
        this.#init();
        return this;
    }

    route(pattern: string | URLPattern, fn: RouteFn): Router {
        if (typeof pattern === "string") {
            let baseURL = DEFAULT_BASE_URL;
            if (this.currentEntry) {
                const { origin, host, protocol } = new URL(this.currentEntry.url);
                if (origin.startsWith(protocol)) {
                    baseURL = origin;
                } else {
                    baseURL = `${protocol}//${host}`;
                }
            }
            pattern = new URLPattern({ pathname: pattern, baseURL });
        }
        this[Routes].add({
            pattern,
            fn
        });
        this.#init();
        return this;
    }

    #init = () => {
        if (this.listening) {
            return;
        }
        this.listening = true;
        this.addEventListener("navigate", this.#navigate);
    }

    #navigate = (event: NavigateEvent) => {
        if (!this[Routes].size) return;
        event.transitionWhile(
            this.#navigationTransition(event)
        );
    }

    #navigationTransition = async (event: NavigateEvent) => {
        const {
            destination: {
                url
            },
            signal
        } = event;
        const promises: Promise<unknown>[] = [];
        for (const route of this[Routes]) {
            if (signal?.aborted) break;
            const { pattern, fn } = route;
            const match = pattern.exec(url);
            if (!match) continue;
            try {
                const maybePromise = fn(event, match);
                if (isPromise(maybePromise)) {
                    promises.push(maybePromise);
                }
            } catch (error) {
                promises.push(Promise.reject(error));
            }
        }
        if (promises.length) {
            await Promise.all(promises);
        }

        function isPromise(value: unknown): value is Promise<unknown> {
            function isPromiseLike(value: unknown): value is Promise<unknown> {
                return !!(
                    value &&
                    typeof value === "object" &&
                    "then" in value
                )
            }
            return (
                isPromiseLike(value) &&
                typeof value.then === "function"
            );
        }

    }

}