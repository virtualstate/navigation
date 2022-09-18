import {isRouter, PatternRouteFn, RouteFn, Router} from "./router";
import {URLPattern} from "urlpattern-polyfill";
import {getNavigation} from "../get-navigation";

let router: Router;

export function getRouter<S = unknown>(): Router<S> {
    if (isRouter<S>(router)) {
        return router;
    }
    const navigation = getNavigation()
    return router = new Router<S>(
        navigation
    );
}

export function route<S = unknown>(pattern: string | URLPattern, fn: PatternRouteFn<S>): Router<S>;
export function route<S = unknown>(fn: RouteFn<S>): Router<S>;
export function route<S = unknown>(...args: ([string | URLPattern, PatternRouteFn<S>] | [RouteFn<S>])): Router<S> {
    let pattern,
        fn;
    if (args.length === 1) {
        ([fn] = args);
    } else if (args.length === 2) {
        ([pattern, fn] = args);
    }
    return routes<S>(pattern).route(fn);
}

export function routes<S = unknown>(pattern: string | URLPattern, router: Router): Router<S>;
export function routes<S = unknown>(pattern: string | URLPattern): Router<S>;
export function routes<S = unknown>(router: Router<S>): Router<S>;
export function routes<S = unknown>(): Router<S>;
export function routes<S = unknown>(...args: [string | URLPattern] | [string | URLPattern, Router<S> | undefined] | [Router<S> | undefined] | []): Router<S> {
    let router: Router<S>;
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