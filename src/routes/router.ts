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
    (error: unknown, event: NavigateEvent): RouteFnReturn;
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

const DEFAULT_BASE_URL = "https://html.spec.whatwg.org/";

export class Router extends NavigationNavigation {

    [Routes]: Route[] = [];
    private listening = false;

    constructor(navigation: Navigation = new NoOperationNavigation()) {
        super(navigation);
    }

    routes(router: Router): Router {
        this[Routes].push({
            router
        })
        this.#init();
        return this;
    }

    catch(pattern: string | URLPattern, fn: ErrorFn): Router
    catch(fn: ErrorFn): Router
    catch(...args: ([string | URLPattern, ErrorFn] | [ErrorFn])): Router
    catch(...args: ([string | URLPattern, ErrorFn] | [ErrorFn])): Router {
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
    route(...args: ([string | URLPattern, RouteFn] | [RouteFn])): Router
    route(...args: ([string | URLPattern, RouteFn] | [RouteFn])): Router {
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
        if (!this[Routes].length) return;
        event.transitionWhile(
            this.#navigationTransition(event)
        );
    }

    #navigationTransition = async (event: NavigateEvent) => {
        let errorRoutes: Route[];

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
                    let isRoute: unknown = false;
                    for (const route of router[Routes]) {
                        if (signal?.aborted) break;
                        try {
                            const maybe = withRoute(route);
                            if (isPromise(maybe)) {
                                promises.push(
                                    maybe.catch(catcher)
                                );
                            } else if (maybe) {
                                isRoute = true;
                            }
                        } catch (error) {
                            promises.push(catcher(error))
                        }
                    }
                    return !!isRoute;
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
                route => route.fn(error, event),
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