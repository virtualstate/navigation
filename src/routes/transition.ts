import {Route, RouteType, URLPatternResult} from "./types";
import {isPromise, like} from "../is";
import {Event} from "../event-target";
import {NavigationDestination} from "../spec/navigation";
import {getRouterRoutes, isRouter, Router} from "./router";
import { compositeKey } from "@virtualstate/composite-key";
import {exec, patternParts, URLPattern} from "./url-pattern";



export async function transitionEvent<E extends Event, R>(router: Router<E, R>, event: E): Promise<void> {
    const promises: Promise<unknown>[] = [];

    const {
        signal,
    } = event;

    const url: URL = getURL(event);
    const { pathname } = url;

    transitionPart(
        "route",
        (route, match) => route.fn(event, match),
        handleResolve,
        handleReject
    );

    if (promises.length) {
        await Promise.all(promises);
    }

    function transitionPart(
        type: RouteType,
        fn: (route: Route<E, R>, match?: URLPatternResult) => unknown,
        resolve = handleResolve,
        reject = handleReject
    ) {
        let isRoute = false;
        resolveRouter(router);
        return isRoute;

        function matchRoute(route: Route<E, R>, parentMatch?: URLPatternResult) {
            const { router, pattern, string } = route;

            let match = parentMatch;

            if (string) {
                if (string !== pathname) {
                    return;
                }
            } else if (pattern) {
                match = exec(pattern, url);
                if (!match) return;
            }

            if (isRouter<E, R>(router)) {
                return resolveRouter(router, match);
            }

            isRoute = true;
            try {
                const maybe = fn(route, match);
                if (isPromise(maybe)) {
                    promises.push(
                        maybe
                            .then(resolve)
                            .catch(reject)
                    );
                } else {
                    resolve(maybe);
                }
            } catch (error) {
                reject(error);
            }
        }

        function resolveRouter(router: Router<E, R>, match?: URLPatternResult) {
            const routes = getRouterRoutes(router);
            resolveRoutes(routes[type]);
            resolveRoutes(routes.router);
            function resolveRoutes(routes: Route<E, R>[]) {
                for (const route of routes) {
                    if (signal?.aborted) break;
                    matchRoute(route, match);
                }
            }
        }

    }

    function noop() {}

    function handleResolve(value: unknown) {
        transitionPart(
            "resolve",
            (route, match) => route.fn(value, event, match),
            noop,
            handleReject
        );
    }

    function handleReject(error: unknown) {
        const isRoute = transitionPart(
            "reject",
            (route, match) => route.fn(error, event, match),
            noop,
            (error) => Promise.reject(error)
        );
        if (!isRoute) {
            throw error;
        }
    }

    function getURL<E extends Event>(event: E) {
        if (isDestination(event)) {
            return new URL(event.destination.url);
        } else if (isRequest(event)) {
            return new URL(event.request.url);
        } else if (isURL(event)) {
            return new URL(event.url);
        }
        throw new Error("Could not get url from event");

        function isDestination(event: E): event is E & { destination: NavigationDestination } {
            return (
                like<{ destination: unknown }>(event) &&
                !!event.destination
            )
        }

        function isRequest(event: E): event is E & { request: Request } {
            return (
                like<{ request: unknown }>(event) &&
                !!event.request
            )
        }

        function isURL(event: E): event is E & { url: string | URL } {
            return (
                like<{ url: unknown }>(event) &&
                !!(
                    event.url && (
                        typeof event.url === "string" ||
                        event.url instanceof URL
                    )
                )
            )
        }
    }



}