import {isRouter, PatternRouteFn, RouteFn, Router} from "./router";
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

export function route(pattern: string | URLPattern, fn: PatternRouteFn): Router;
export function route(fn: RouteFn): Router;
export function route(...args: ([string | URLPattern, PatternRouteFn] | [RouteFn])): Router {
    let pattern,
        fn;
    if (args.length === 1) {
        ([fn] = args);
    } else if (args.length === 2) {
        ([pattern, fn] = args);
    }
    return routes(pattern).route(fn);
}

export function routes(pattern: string | URLPattern, router: Router): Router;
export function routes(pattern: string | URLPattern): Router;
export function routes(router: Router): Router;
export function routes(): Router;
export function routes(...args: [string | URLPattern] | [string | URLPattern, Router | undefined] | [Router | undefined] | []): Router {
    let router: Router;
    if (!args.length) {
        router = new Router();
        getRouter().routes(router);
    } else if (args.length === 1) {
        const [arg] = args;
        if (isRouter(arg)) {
            router = arg;
            getRouter().routes(arg);
        } else {
            const pattern = arg;
            router = new Router();
            getRouter().routes(pattern, router);
        }
    } else if (args.length >= 2) {
        const [pattern, routerArg] = args;
        router = routerArg ?? new Router();
        getRouter().routes(pattern, router);
    }
    return router;


}