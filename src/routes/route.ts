import {RouteFn, Router} from "./router";

let router: Router;

export function getRouter(): Router {
    if (!router) {
        router = new Router();
    }
    return router;
}

export function route(pattern: string, fn: RouteFn) {
    getRouter().route(pattern, fn);
}

export function routes(router: Router) {
    getRouter().routes(router);
}