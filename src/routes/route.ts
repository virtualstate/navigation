import { isRouter, Router } from "./router";
import { URLPattern } from "./url-pattern";
import { getNavigation } from "../get-navigation";
import {Event} from "../event-target";
import {NavigateEvent} from "../spec/navigation";
import {PatternRouteFn, RouteFn} from "./types";

let router: Router<Event>;

export function getRouter<E extends Event = NavigateEvent, R = void | unknown>(): Router<E, R> {
  if (isRouter<E, R>(router)) {
    return router;
  }
  const navigation = getNavigation();
  const local = new Router<E, R>(navigation, "navigate");
  router = local;
  return local;
}

export function route<E extends Event = NavigateEvent, R = void | unknown>(
  pattern: string | URLPattern,
  fn: PatternRouteFn<E, R>
): Router<E, R>;
export function route<E extends Event = NavigateEvent, R = void | unknown>(
  fn: RouteFn<E, R>
): Router<E, R>;
export function route<E extends Event = NavigateEvent, R = void | unknown>(
  ...args: [string | URLPattern, PatternRouteFn<E, R>] | [RouteFn<E, R>]
): Router<E, R> {
  let pattern, fn;
  if (args.length === 1) {
    [fn] = args;
  } else if (args.length === 2) {
    [pattern, fn] = args;
  }
  return routes<E, R>(pattern).route(fn);
}

export function routes<E extends Event = NavigateEvent, R = void | unknown>(
  pattern: string | URLPattern,
  router: Router<E, R>
): Router<E, R>;
export function routes<E extends Event = NavigateEvent, R = void | unknown>(
  pattern: string | URLPattern
): Router<E, R>;
export function routes<E extends Event = NavigateEvent, R = void | unknown>(
  router: Router<E, R>
): Router<E, R>;
export function routes<E extends Event = NavigateEvent, R = void | unknown>(): Router<E, R>;
export function routes<E extends Event, R>(
  ...args:
    | [string | URLPattern]
    | [string | URLPattern, Router<E, R> | undefined]
    | [Router<E, R> | undefined]
    | []
): Router<E, R> {
  let router: Router<E, R>;
  if (!args.length) {
    router = new Router<E, R>();
    getRouter<E, R>().routes(router);
  } else if (args.length === 1) {
    const [arg] = args;
    if (isRouter<E, R>(arg)) {
      router = arg;
      getRouter<E, R>().routes(router);
    } else {
      const pattern = arg;
      router = new Router();
      getRouter<E, R>().routes(pattern, router);
    }
  } else if (args.length >= 2) {
    const [pattern, routerArg] = args;
    router = routerArg ?? new Router();
    getRouter<E, R>().routes(pattern, router);
  }
  return router;
}
