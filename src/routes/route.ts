import { isRouter, Router } from "./router";
import { URLPattern } from "urlpattern-polyfill";
import { getNavigation } from "../get-navigation";
import {Event} from "../event-target";
import {NavigateEvent} from "../spec/navigation";
import {PatternRouteFn, RouteFn} from "./types";

let router: Router<unknown, unknown, Event>;

export function getRouter<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>>(): Router<S, R, E> {
  if (isRouter<S, R, E>(router)) {
    return router;
  }
  const navigation = getNavigation();
  const local = new Router<S, R, E>(navigation, "navigate");
  router = local;
  return local;
}

export function route<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>>(
  pattern: string | URLPattern,
  fn: PatternRouteFn<S, R, E>
): Router<S, R, E>;
export function route<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>>(
  fn: RouteFn<S, R, E>
): Router<S, R, E>;
export function route<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>>(
  ...args: [string | URLPattern, PatternRouteFn<S, R, E>] | [RouteFn<S, R, E>]
): Router<S, R, E> {
  let pattern, fn;
  if (args.length === 1) {
    [fn] = args;
  } else if (args.length === 2) {
    [pattern, fn] = args;
  }
  return routes<S, R, E>(pattern).route(fn);
}

export function routes<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>>(
  pattern: string | URLPattern,
  router: Router<S, R, E>
): Router<S, R, E>;
export function routes<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>>(
  pattern: string | URLPattern
): Router<S, R, E>;
export function routes<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>>(
  router: Router<S, R, E>
): Router<S, R, E>;
export function routes<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>>(): Router<S, R>;
export function routes<S = unknown, R = void | unknown, E extends Event = Event>(
  ...args:
    | [string | URLPattern]
    | [string | URLPattern, Router<S, R, E> | undefined]
    | [Router<S, R, E> | undefined]
    | []
): Router<S, R, E> {
  let router: Router<S, R, E>;
  if (!args.length) {
    router = new Router<S, R, E>();
    getRouter<S, R, E>().routes(router);
  } else if (args.length === 1) {
    const [arg] = args;
    if (isRouter<S, R, E>(arg)) {
      router = arg;
      getRouter<S, R, E>().routes(router);
    } else {
      const pattern = arg;
      router = new Router();
      getRouter<S, R, E>().routes(pattern, router);
    }
  } else if (args.length >= 2) {
    const [pattern, routerArg] = args;
    router = routerArg ?? new Router();
    getRouter<S, R, E>().routes(pattern, router);
  }
  return router;
}
