import {NavigationNavigation} from "../navigation-navigation";
import {Navigation, NavigateEvent} from "../spec/navigation";
import {URLPattern} from "urlpattern-polyfill";
import {NoOperationNavigation} from "../noop-navigation";

type NonNil<T> = T extends (null | undefined) ? never : T;
export type URLPatternResult = NonNil<ReturnType<URLPattern["exec"]>>

export type RouteFnReturn = Promise<void | unknown> | unknown | void;

export interface RouteFn {
    (event: NavigateEvent, ...args: unknown[]): RouteFnReturn;
}

export interface ErrorFn {
    (event: NavigateEvent, error: unknown): RouteFnReturn;
}

export interface PatternRouteFn {
    (event: NavigateEvent, match: URLPatternResult): RouteFnReturn
}

interface Route {
    pattern?: URLPattern;
    error?: boolean;
    fn: RouteFn
}

const Routes = Symbol.for("@virtualstate/navigation/routes/routes");

const DEFAULT_BASE_URL = "https://html.spec.whatwg.org/";

export class Router extends NavigationNavigation {

    [Routes] = new Set<Route>();
    private listening = false;

    constructor(navigation: Navigation = new NoOperationNavigation()) {
        super(navigation);
    }

    routes(router: Router): Router {
        for (const route of router[Routes]) {
            this[Routes].add(route);
        }
        this.#init();
        return this;
    }

    catch(pattern: string | URLPattern, fn: ErrorFn): Router
    catch(fn: ErrorFn): Router
    catch(...args: ([string | URLPattern, ErrorFn] | [ErrorFn])): Router
    catch(...args: ([string | URLPattern, ErrorFn] | [ErrorFn])): Router {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].add({
                fn,
                error: true
            });
        } else {
            const [pattern, fn] = args;
            this[Routes].add({
                pattern: this.#getPattern(pattern),
                fn,
                error: true
            });
        }
        // No init for just catch
        return this;
    }

    route(pattern: string | URLPattern, fn: PatternRouteFn): Router
    route(fn: RouteFn): Router
    route(...args: ([string | URLPattern, RouteFn] | [RouteFn])): Router
    route(...args: ([string | URLPattern, RouteFn] | [RouteFn])): Router {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].add({
                fn
            });
        } else {
            const [pattern, fn] = args;
            this[Routes].add({
                pattern: this.#getPattern(pattern),
                fn
            });
        }
        this.#init();
        return this;
    }

    #getPattern = (pattern: string | URLPattern): URLPattern => {
        if (typeof pattern !== "string") {
            return pattern;
        }
        let baseURL = DEFAULT_BASE_URL;
        if (this.currentEntry) {
            const { origin, host, protocol } = new URL(this.currentEntry.url);
            if (origin.startsWith(protocol)) {
                baseURL = origin;
            } else {
                baseURL = `${protocol}//${host}`;
            }
        }
        return new URLPattern({ pathname: pattern, baseURL });
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
        let errorRoutes: Route[];

        const routes = this[Routes];

        const {
            destination: {
                url
            },
            signal
        } = event;

        try {
            await transition(
                route => !route.error,
                (route, match) => route.fn(event, match),
                handleError
            );
        } catch (error) {
            await handleError(error);
        }

        async function transition(use: (route: Route) => boolean, fn: (route: Route, match?: URLPatternResult) => unknown, catcher = handleError) {
            const promises: Promise<unknown>[] = [];
            for (const route of routes) {
                if (signal?.aborted) break;
                if (!use(route)) continue;
                try {
                    const maybePromise = withRoute(route);
                    if (isPromise(maybePromise)) {
                        promises.push(
                            maybePromise.catch(catcher)
                        );
                    }
                } catch (error) {
                    promises.push(catcher(error))
                }
            }
            if (promises.length) {
                await Promise.all(promises);
            }

            function withRoute(route: Route) {
                const { pattern } = route;
                if (pattern) {
                    const match = pattern.exec(url);
                    if (!match) return;
                    return fn(route, match);
                } else {
                    return fn(route);
                }
            }
        }

        function getErrorRoutes() {
            if (errorRoutes) {
                return errorRoutes;
            }
            return errorRoutes = [...routes].filter(({ error }) => error);
        }

        async function handleError(error: unknown) {
            const routes = getErrorRoutes();
            console.log(routes)
            if (!routes.length) {
                throw await Promise.reject(error);
            }
            await transition(
                route => route.error,
                route => route.fn(event, error),
                error => Promise.reject(error)
            );
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