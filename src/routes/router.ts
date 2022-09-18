import {NavigationNavigation} from "../navigation-navigation";
import {Navigation, NavigateEvent} from "../spec/navigation";
import {URLPattern} from "urlpattern-polyfill";
import {NoOperationNavigation} from "../noop-navigation";

type NonNil<T> = T extends (null | undefined) ? never : T;
export type URLPatternResult = NonNil<ReturnType<URLPattern["exec"]>>

export type RouteFnReturn = Promise<void | unknown> | unknown | void;

export interface RouteFn {
    (...args: unknown[]): RouteFnReturn;
}

export interface ErrorFn {
    (error: unknown, event: NavigateEvent, match?: URLPatternResult): RouteFnReturn;
}

export interface PatternErrorFn {
    (error: unknown, event: NavigateEvent, match: URLPatternResult): RouteFnReturn;
}

export interface ThenFn {
    (value: unknown, event: NavigateEvent, match?: URLPatternResult): RouteFnReturn;
}

export interface PatternThenFn {
    (value: unknown, event: NavigateEvent, match: URLPatternResult): RouteFnReturn;
}

export interface PatternRouteFn {
    (event: NavigateEvent, match: URLPatternResult): RouteFnReturn
}

interface Route {
    pattern?: URLPattern;
    fn?: RouteFn
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

    routes(pattern: string | URLPattern, router: Router): Router
    routes(router: Router): Router
    routes(...args: ([string | URLPattern, Router] | [Router])): Router
    routes(...args: ([string | URLPattern, Router] | [Router])): Router {
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

    then(pattern: string | URLPattern, fn: PatternThenFn): Router
    then(fn: ThenFn): Router
    then(...args: ([string | URLPattern, PatternThenFn] | [ThenFn])): Router
    then(...args: ([string | URLPattern, PatternThenFn] | [ThenFn])): Router {
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

    catch(pattern: string | URLPattern, fn: PatternErrorFn): Router
    catch(fn: ErrorFn): Router
    catch(...args: ([string | URLPattern, PatternErrorFn] | [ErrorFn])): Router
    catch(...args: ([string | URLPattern, PatternErrorFn] | [ErrorFn])): Router {
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

    route(pattern: string | URLPattern, fn: PatternRouteFn): Router
    route(fn: RouteFn): Router
    route(...args: ([string | URLPattern, PatternRouteFn] | [RouteFn])): Router
    route(...args: ([string | URLPattern, PatternRouteFn] | [RouteFn])): Router {
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

    #navigate = (event: NavigateEvent) => {
        event.transitionWhile(
            this.#navigationTransition(event)
        );
    }

    #navigationTransition = async (event: NavigateEvent) => {
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
            withRoute({
                router
            })
            if (promises.length) {
                await Promise.all(promises);
            }
            return isRoute;

            function withRoute(route: Route, parentMatch?: URLPatternResult) {
                const { router, pattern } = route;
                if (!router) {
                    if (pattern) {
                        const match = pattern.exec(url);
                        if (!match) return;
                        isRoute = true;
                        return fn(route, match);
                    }
                    isRoute = true;
                    return fn(route, parentMatch);
                }

                let routerMatch: URLPatternResult | undefined = undefined;
                if (pattern && !(routerMatch = pattern.exec(url))) {
                    return;
                }
                resolveRoutes(router[Routes][type]);
                resolveRoutes(router[Routes].router);

                function resolveRoutes(routes: Route[]) {
                    for (const route of routes) {
                        if (signal?.aborted) break;
                        resolveRoute(route);
                    }
                }

                async function resolveRoute(route: Route) {
                    try {
                        const maybe = withRoute(route, routerMatch ?? parentMatch);
                        if (isPromise(maybe)) {
                            return promises.push(
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
                                return promises.push(
                                    resolve(maybe)
                                );
                            }
                        }
                    } catch (error) {
                        return promises.push(
                            reject(error)
                        )
                    }
                }
            }
        }

        async function asyncNoop() {
        }

        async function handleResolve(value: unknown) {
            console.log("handleResolve", { value });
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