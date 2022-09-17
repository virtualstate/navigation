import {PatternRouteFn, RouteFn, Router} from "./router";
import {URLPattern} from "urlpattern-polyfill";
import {getNavigation} from "../get-navigation";

let router: Router;

export function getRouter(): Router {
    if (!router) {
        const navigation = getNavigation()
        router = new Router(
            navigation
        );
    }
    return router;
}

export function route(pattern: string | URLPattern, fn: PatternRouteFn): void;
export function route(fn: RouteFn): void;
export function route(...args: ([string | URLPattern, RouteFn] | [RouteFn])) {
    getRouter().route(...args);
}

export function routes(router: Router = new Router()) {
    getRouter().routes(router);
    return router;
}