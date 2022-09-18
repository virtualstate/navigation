import {NavigationNavigation} from "../navigation-navigation";
import {Navigation, NavigateEvent} from "../spec/navigation";
import {URLPattern} from "urlpattern-polyfill";
import {NoOperationNavigation} from "../noop-navigation";

type NonNil<T> = T extends (null | undefined) ? never : T;
export type URLPatternResult = NonNil<ReturnType<URLPattern["exec"]>>

export type RouteFnReturn = Promise<void | unknown> | unknown | void;

export interface Fn {
    (...args: unknown[]): RouteFnReturn;
}

export interface RouteFn<S = unknown> {
    (event: NavigateEvent<S>, match?: URLPatternResult): RouteFnReturn;
}

export interface ErrorFn<S = unknown> {
    (error: unknown, event: NavigateEvent<S>, match?: URLPatternResult): RouteFnReturn;
}

export interface PatternErrorFn<S = unknown> {
    (error: unknown, event: NavigateEvent<S>, match: URLPatternResult): RouteFnReturn;
}

export interface ThenFn<S = unknown> {
    (value: unknown, event: NavigateEvent<S>, match?: URLPatternResult): RouteFnReturn;
}

export interface PatternThenFn<S = unknown> {
    (value: unknown, event: NavigateEvent<S>, match: URLPatternResult): RouteFnReturn;
}

export interface PatternRouteFn<S = unknown> {
    (event: NavigateEvent<S>, match: URLPatternResult): RouteFnReturn
}

interface Route {
    pattern?: URLPattern;
    fn?: Fn;
    router?: Router;
}

type RouteType = "route" | "reject" | "resolve";

interface RouteRecord extends Record<RouteType, Route[]> {
    router: Route[];
}

const Routes = Symbol.for("@virtualstate/navigation/routes/routes");
const Attached = Symbol.for("@virtualstate/navigation/routes/attached");
const Detach = Symbol.for("@virtualstate/navigation/routes/detach");

export function isRouter(value: unknown): value is Router {
    function isRouterLike(value: unknown): value is { [Routes]: unknown } {
        return !!value;
    }
    return (
        isRouterLike(value) &&
        Array.isArray(value[Routes])
    );
}

const DEFAULT_BASE_URL = "https://html.spec.whatwg.org/";

export class Router<S = unknown> extends NavigationNavigation<S> {

    [Routes]: RouteRecord = {
        router: [],
        route: [],
        reject: [],
        resolve: []
    };
    [Attached] = new Set<Router<S>>();

    private listening = false;

    constructor(navigation: Navigation<S> = new NoOperationNavigation<S>()) {
        super(navigation);

        // Catch use override types with
        // arrow functions so need to bind manually
        this.routes = this.routes.bind(this);
        this.route = this.route.bind(this);
        this.then = this.then.bind(this);
        this.catch = this.catch.bind(this);
    }

    routes(pattern: string | URLPattern, router: Router): Router<S>
    routes(router: Router<S>): Router<S>
    routes(...args: ([string | URLPattern, Router<S>] | [Router<S>])): Router<S>
    routes(...args: ([string | URLPattern, Router<S>] | [Router<S>])): Router<S> {
        let router, pattern
        if (args.length === 1) {
            ([router] = args);
        } else if (args.length === 2) {
            ([pattern, router] = args);
        }
        if (router[Attached].has(this)) {
            throw new Error("Router already attached");
        }
        this[Routes].router.push({
            pattern: this.#getPattern(pattern),
            router
        })
        router[Attached].add(this);
        this.#init();
        return this;
    }

    then(pattern: string | URLPattern, fn: PatternThenFn<S>): Router
    then(fn: ThenFn<S>): Router
    then(...args: ([string | URLPattern, PatternThenFn<S>] | [ThenFn<S>])): Router
    then(...args: ([string | URLPattern, PatternThenFn<S>] | [ThenFn<S>])): Router {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].resolve.push({
                fn
            });
        } else {
            const [pattern, fn] = args;
            this[Routes].resolve.push({
                pattern: this.#getPattern(pattern),
                fn
            })
        }
        // No init for just then
        return this;
    }

    catch(pattern: string | URLPattern, fn: PatternErrorFn<S>): Router<S>
    catch(fn: ErrorFn<S>): Router<S>
    catch(...args: ([string | URLPattern, PatternErrorFn<S>] | [ErrorFn<S>])): Router<S>
    catch(...args: ([string | URLPattern, PatternErrorFn<S>] | [ErrorFn<S>])): Router<S> {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].reject.push({
                fn
            });
        } else {
            const [pattern, fn] = args;
            this[Routes].reject.push({
                pattern: this.#getPattern(pattern),
                fn
            });
        }
        // No init for just catch
        return this;
    }

    route(pattern: string | URLPattern, fn: PatternRouteFn<S>): Router<S>
    route(fn: RouteFn<S>): Router<S>
    route(...args: ([string | URLPattern, PatternRouteFn<S>] | [RouteFn<S>])): Router<S>
    route(...args: ([string | URLPattern, PatternRouteFn<S>] | [RouteFn<S>])): Router<S> {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].route.push({
                fn
            });
        } else {
            const [pattern, fn] = args;
            this[Routes].route.push({
                pattern: this.#getPattern(pattern),
                fn
            });
        }
        this.#init();
        return this;
    }

    [Detach](router: Router) {
        const index = this[Routes].router.findIndex(route => route.router === router);
        if (index > -1) {
            this[Routes].router.splice(index, 1);
        }

        const length = Object.values(this[Routes])
            .reduce((sum, routes) => sum + routes.length, 0);

        if (length === 0) {
            this.#deinit();
        }
    }

    detach = () => {
        if (this.listening) {
            this.#deinit();
        }
        for (const attached of this[Attached]) {
            attached[Detach](this);
        }
        this[Attached] = new Set();
    }

    #getPattern = (pattern?: string | URLPattern): URLPattern => {
        if (!pattern) return undefined;
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

    #deinit = () => {
        if (!this.listening) {
            return;
        }
        this.listening = false;
        this.removeEventListener("navigate", this.#navigate);
    }

    #navigate = (event: NavigateEvent<S>) => {
        event.transitionWhile(
            this.#navigationTransition(event)
        );
    }

    #navigationTransition = async (event: NavigateEvent<S>) => {
        const router = this;

        const {
            destination: {
                url
            },
            signal
        } = event;

        try {
            await transition(
                "route",
                (route, match) => route.fn(event, match),
                handleResolve,
                handleReject
            );
        } catch (error) {
            await handleReject(error);
        }

        async function transition(
            type: RouteType,
            fn: (route: Route, match?: URLPatternResult) => unknown,
            resolve = handleResolve,
            reject = handleReject
        ) {
            const promises: Promise<unknown>[] = [];
            let isRoute = false;
            resolveRouter(router);
            if (promises.length) {
                await Promise.all(promises);
            }
            return isRoute;

            function matchRoute(route: Route, parentMatch?: URLPatternResult) {
                const { router, pattern } = route;

                let match = parentMatch;

                if (pattern) {
                    match = pattern.exec(url);
                    if (!match) return;
                }

                if (router) {
                    resolveRouter(router, match);
                } else {
                    isRoute = true;
                    return fn(route, match);
                }
            }

            function resolveRouter(router: Router, match?: URLPatternResult) {
                resolveRoutes(router[Routes][type]);
                resolveRoutes(router[Routes].router);
                function resolveRoutes(routes: Route[]) {
                    for (const route of routes) {
                        if (signal?.aborted) break;
                        resolveRoute(route, match);
                    }
                }
            }

            function resolveRoute(route: Route, match?: URLPatternResult) {
                try {
                    const maybe = matchRoute(route, match);
                    if (isPromise(maybe)) {
                        promises.push(
                            maybe
                                .then(value => {
                                    if (typeof value !== "undefined") {
                                        return resolve(value);
                                    }
                                })
                                .catch(reject)
                        );
                    } else {
                        if (typeof maybe !== "undefined") {
                            promises.push(
                                resolve(maybe)
                            );
                        }
                    }
                } catch (error) {
                    promises.push(
                        reject(error)
                    )
                }
            }
        }

        async function asyncNoop() {
        }

        async function handleResolve(value: unknown) {
            await transition(
                "resolve",
                (route, match) => route.fn(value, event, match),
                asyncNoop,
                handleReject
            );
            return value;
        }

        async function handleReject(error: unknown) {
            const isRoute = await transition(
                "reject",
                (route, match) => route.fn(error, event, match),
                asyncNoop,
                    error => Promise.reject(error)
            );
            if (!isRoute) {
                throw await Promise.reject(error);
            }
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