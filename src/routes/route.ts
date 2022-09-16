import {RouteFn, Router} from "./router";

export let router: Router;

export function route(pattern: string, fn: RouteFn) {
    if (!router) {
        router = new Router();
    }
    router.route(pattern, fn);
}

