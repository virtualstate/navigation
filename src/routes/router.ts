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

export interface PatternRouteFn {
    (event: NavigateEvent, match: URLPatternResult): RouteFnReturn
}

interface Route {
    pattern?: URLPattern;
    error?: boolean;
    fn?: RouteFn
    router?: Router;
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

export class Router extends NavigationNavigation {

    [Routes]: Route[] = [];
    [Attached] = new Set<Router>();

    private listening = false;

    constructor(navigation: Navigation = new NoOperationNavigation()) {
        super(navigation);
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
        this[Routes].push({
            pattern: this.#getPattern(pattern),
            router
        })
        router[Attached].add(this);
        this.#init();
        return this;
    }

    catch(pattern: string | URLPattern, fn: PatternErrorFn): Router
    catch(fn: ErrorFn): Router
    catch(...args: ([string | URLPattern, PatternErrorFn] | [ErrorFn])): Router
    catch(...args: ([string | URLPattern, PatternErrorFn] | [ErrorFn])): Router {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].push({
                fn,
                error: true
            });
        } else {
            const [pattern, fn] = args;
            this[Routes].push({
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
    route(...args: ([string | URLPattern, PatternRouteFn] | [RouteFn])): Router
    route(...args: ([string | URLPattern, PatternRouteFn] | [RouteFn])): Router {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].push({
                fn
            });
        } else {
            const [pattern, fn] = args;
            this[Routes].push({
                pattern: this.#getPattern(pattern),
                fn
            });
        }
        this.#init();
        return this;
    }

    [Detach](router: Router) {
        const index = this[Routes].findIndex(route => route.router === router);
        if (index > -1) {
            this[Routes].splice(index, 1);
        }
        if (!this[Routes].length) {
            this.#deinit();
        }
    }

    detach = () => {
        for (const attached of this[Attached]) {
            attached[Detach](this);
        }
        this[Attached] = new Set();
        if (this.listening) {
            this.#deinit();
        }
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
        if (!this[Routes].length) return;
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
                route => !route.error,
                (route, match) => route.fn(event, match),
                handleError
            );
        } catch (error) {
            await handleError(error);
        }

        async function transition(use: (route: Route) => boolean, fn: (route: Route, match?: URLPatternResult) => unknown, catcher = handleError) {
            const promises: Promise<unknown>[] = [];
            const isRoute = withRoute({
                router
            })
            if (promises.length) {
                await Promise.all(promises);
            }
            return isRoute;

            function withRoute(route: Route) {
                const { router } = route;
                if (router) {
                    const { pattern } = route;
                    if (pattern && !pattern.test(url)) {
                        return;
                    }
                    let isRoute: boolean = false;
                    for (const route of router[Routes]) {
                        if (signal?.aborted) break;
                        try {
                            const maybe = withRoute(route);
                            if (maybe !== false) {
                                isRoute = true;
                            }
                            if (isPromise(maybe)) {
                                promises.push(
                                    maybe.catch(catcher)
                                );
                            }
                        } catch (error) {
                            promises.push(catcher(error))
                        }
                    }
                    return isRoute;
                } else {
                    if (!use(route)) return false;
                    const { pattern } = route;
                    if (pattern) {
                        const match = pattern.exec(url);
                        if (!match) return false;
                        return fn(route, match) ?? true;
                    } else {
                        return fn(route) ?? true;
                    }
                }
            }
        }

        async function handleError(error: unknown) {
            const isRoute = await transition(
                route => route.error,
                (route, match) => route.fn(error, event, match),
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