import { isRouter, PatternRouteFn, RouteFn, Router } from "./router";
import { URLPattern } from "urlpattern-polyfill";
import { getNavigation } from "../get-navigation";

declare module globalThis {
  let $__router_navigation_virtualstate: Router;
}

export function getRouter<S = unknown, R = void | unknown>(): Router<S, R> {
  if (isRouter<S, R>(globalThis.$__router_navigation_virtualstate)) {
    return globalThis.$__router_navigation_virtualstate;
  }
  const navigation = getNavigation();
  return (globalThis.$__router_navigation_virtualstate = new Router<S, R>(navigation));
}

export function route<S = unknown, R = void | unknown>(
  pattern: string | URLPattern,
  fn: PatternRouteFn<S, R>
): Router<S, R>;
export function route<S = unknown, R = void | unknown>(
  fn: RouteFn<S, R>
): Router<S, R>;
export function route<S = unknown, R = void | unknown>(
  ...args: [string | URLPattern, PatternRouteFn<S, R>] | [RouteFn<S, R>]
): Router<S, R> {
  let pattern, fn;
  if (args.length === 1) {
    [fn] = args;
  } else if (args.length === 2) {
    [pattern, fn] = args;
  }
  return routes<S, R>(pattern).route(fn);
}

export function routes<S = unknown, R = void | unknown>(
  pattern: string | URLPattern,
  router: Router<S, R>
): Router<S, R>;
export function routes<S = unknown, R = void | unknown>(
  pattern: string | URLPattern
): Router<S, R>;
export function routes<S = unknown, R = void | unknown>(
  router: Router<S, R>
): Router<S, R>;
export function routes<S = unknown, R = void | unknown>(): Router<S, R>;
export function routes<S = unknown, R = void | unknown>(
  ...args:
    | [string | URLPattern]
    | [string | URLPattern, Router<S, R> | undefined]
    | [Router<S, R> | undefined]
    | []
): Router<S, R> {
  let router: Router<S, R>;
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
