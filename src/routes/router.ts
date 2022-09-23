import { NavigateEvent, NavigationDestination} from "../spec/navigation";
import { URLPattern } from "urlpattern-polyfill";
import { Event } from "../event-target";
import {isPromise, like, ok} from "../is";

type NonNil<T> = T extends null | undefined ? never : T;
export type URLPatternResult = NonNil<ReturnType<URLPattern["exec"]>>;

export type RouteFnReturn<R = void | unknown> = Promise<R> | R;

export interface Fn {
  (...args: unknown[]): RouteFnReturn;
}

export interface RouteFn<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>> {
  (event: E, match?: URLPatternResult): RouteFnReturn<R>;
}

export interface ErrorFn<S = unknown, E extends Event = NavigateEvent<S>> {
  (
      error: unknown,
      event: E,
      match?: URLPatternResult
  ): RouteFnReturn;
}

export interface PatternErrorFn<S = unknown, E extends Event = NavigateEvent<S>> {
  (
      error: unknown,
      event: E,
      match: URLPatternResult
  ): RouteFnReturn;
}

export interface ThenFn<S = unknown, R = unknown, E extends Event = NavigateEvent<S>> {
  (value: R, event: E, match?: URLPatternResult): RouteFnReturn;
}

export interface PatternThenFn<S = unknown, R = unknown, E extends Event = NavigateEvent<S>> {
  (value: R, event: E, match: URLPatternResult): RouteFnReturn;
}

export interface PatternRouteFn<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>> {
  (event: E, match: URLPatternResult): RouteFnReturn<R>;
}

interface Route<S, R, E extends Event> {
  pattern?: URLPattern;
  fn?: Fn;
  router?: Router<S, R, E>;
}

type RouteType = "route" | "reject" | "resolve";

interface RouteRecord<S, R, E extends Event> extends Record<RouteType, Route<S, R, E>[]> {
  router: Route<S, R, E>[];
}

const Routes = Symbol.for("@virtualstate/navigation/routes/routes");
const Attached = Symbol.for("@virtualstate/navigation/routes/attached");
const Detach = Symbol.for("@virtualstate/navigation/routes/detach");
const Target = Symbol.for("@virtualstate/navigation/routes/target");
const TargetType = Symbol.for("@virtualstate/navigation/routes/target/type");

export function isRouter<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>>(
    value: unknown
): value is Router<S, R, E> {
  function isRouterLike(value: unknown): value is { [Routes]: unknown } {
    return !!value;
  }
  return isRouterLike(value) && !!value[Routes];
}

interface RouterListeningFn<E extends Event> {
  (event: E): RouteFnReturn
}

interface RouterListenFn<E extends Event = NavigateEvent> {
  (fn: RouterListeningFn<E>): void;
}

interface EventListenerTarget<E extends Event> {
  addEventListener(type: E["type"], handler: RouterListeningFn<E>): void;
  removeEventListener(type: E["type"], handler: RouterListeningFn<E>): void;
}

type RouterListenTarget<E extends Event> = RouterListenFn<E> | EventListenerTarget<E>

export class Router<
  S = unknown,
  R = void | unknown,
  E extends Event = NavigateEvent<S>
> {
  [Routes]: RouteRecord<S, R, E> = {
    router: [],
    route: [],
    reject: [],
    resolve: [],
  };
  [Attached] = new Set<Router<S, R, E>>();
  [Target]: RouterListenTarget<E>;
  [TargetType]: E["type"];

  private listening = false;

  constructor(target?: RouterListenTarget<E>, type?: E["type"]) {

    this[Target] = target;
    this[TargetType] = type;

    // Catch use override types with
    // arrow functions so need to bind manually
    this.routes = this.routes.bind(this);
    this.route = this.route.bind(this);
    this.then = this.then.bind(this);
    this.catch = this.catch.bind(this);
  }

  routes(pattern: string | URLPattern, router: Router<S, R, E>): this;
  routes(router: Router<S, R, E>): this;
  routes(...args: [string | URLPattern, Router<S, R, E>] | [Router<S, R, E>]): this;
  routes(...args: [string | URLPattern, Router<S, R, E>] | [Router<S, R, E>]): this {
    let router, pattern;
    if (args.length === 1) {
      [router] = args;
    } else if (args.length === 2) {
      [pattern, router] = args;
    }
    if (router[Attached].has(this)) {
      throw new Error("Router already attached");
    }
    this[Routes].router.push({
      pattern: this.#getPattern(pattern),
      router,
    });
    router[Attached].add(this);
    this.#init();
    return this;
  }

  then(pattern: string | URLPattern, fn: PatternThenFn<S, R>): this;
  then(fn: ThenFn<S, R>): this;
  then(
      ...args: [string | URLPattern, PatternThenFn<S, R>] | [ThenFn<S, R>]
  ): this;
  then(
      ...args: [string | URLPattern, PatternThenFn<S, R>] | [ThenFn<S, R>]
  ): this {
    if (args.length === 1) {
      const [fn] = args;
      this[Routes].resolve.push({
        fn,
      });
    } else {
      const [pattern, fn] = args;
      this[Routes].resolve.push({
        pattern: this.#getPattern(pattern),
        fn,
      });
    }
    // No init for just then
    return this;
  }

  catch(pattern: string | URLPattern, fn: PatternErrorFn<S, E>): this;
  catch(fn: ErrorFn<S, E>): this;
  catch(...args: [string | URLPattern, PatternErrorFn<S, E>] | [ErrorFn<S, E>]): this;
  catch(
      ...args: [string | URLPattern, PatternErrorFn<S, E>] | [ErrorFn<S, E>]
  ): this {
    if (args.length === 1) {
      const [fn] = args;
      this[Routes].reject.push({
        fn,
      });
    } else {
      const [pattern, fn] = args;
      this[Routes].reject.push({
        pattern: this.#getPattern(pattern),
        fn,
      });
    }
    // No init for just catch
    return this;
  }

  route(pattern: string | URLPattern, fn: PatternRouteFn<S, R, E>): this;
  route(fn: RouteFn<S, R, E>): this;
  route(
      ...args: [string | URLPattern, PatternRouteFn<S, R, E>] | [RouteFn<S, R, E>]
  ): this;
  route(
      ...args: [string | URLPattern, PatternRouteFn<S, R, E>] | [RouteFn<S, R, E>]
  ): this {
    if (args.length === 1) {
      const [fn] = args;
      this[Routes].route.push({
        fn,
      });
    } else {
      const [pattern, fn] = args;
      this[Routes].route.push({
        pattern: this.#getPattern(pattern),
        fn,
      });
    }
    this.#init();
    return this;
  }

  [Detach](router: Router<S, R, E>) {
    const index = this[Routes].router.findIndex(
        (route) => route.router === router
    );
    if (index > -1) {
      this[Routes].router.splice(index, 1);
    }

    const length = Object.values(this[Routes]).reduce(
        (sum, routes) => sum + routes.length,
        0
    );

    if (length === 0) {
      this.#deinit();
    }
  }

  detach = () => {
    if (this.listening) {
      this.#deinit();
    }
    for (const attached of this[Attached]) {
      if (isRouter<S, R, E>(attached)) {
        attached[Detach](this);
      }
    }
    this[Attached] = new Set();
  };

  #getPattern = (pattern?: string | URLPattern): URLPattern => {
    if (!pattern) return undefined;
    if (typeof pattern !== "string") {
      return pattern;
    }
    return new URLPattern({ pathname: pattern });
  }

  #init = () => {
    if (this.listening) {
      return;
    }
    const target = this[Target];
    if (!target) return;
    this.listening = true;
    if (typeof target === "function") {
      return target(this.#navigate);
    }
    const type = this[TargetType] ?? "navigate";
    target.addEventListener(type, this.#navigate);
  };

  #deinit = () => {
    if (!this.listening) {
      return;
    }
    const target = this[Target];
    if (!target) return;
    if (typeof target === "function") {
      throw new Error("Cannot stop listening");
    }
    this.listening = false;
    const type = this[TargetType] ?? "navigate";
    target.removeEventListener(type, this.#navigate);
  };

  #navigate = (event: E) => {
    if (!event.canIntercept) return;

    if (isIntercept(event)) {
      event.intercept(this.#navigationTransition(event));
    } else if (isTransitionWhile(event)) {
      event.transitionWhile(this.#navigationTransition(event));
    } else if (isRespondWith(event)) {
      event.respondWith(this.#navigationTransition(event));
    } else {
      return this.#navigationTransition(event);
    }

    function isIntercept(event: E): event is E & { intercept(promise: Promise<unknown>): void } {
      return (
          like<{ intercept: unknown }>(event) &&
          typeof event.intercept === "function"
      )
    }

    function isTransitionWhile(event: E): event is E & { transitionWhile(promise: Promise<unknown>): void } {
      return (
          like<{ transitionWhile: unknown }>(event) &&
          typeof event.transitionWhile === "function"
      )
    }

    function isRespondWith(event: E): event is E & { respondWith(promise: Promise<unknown>): void } {
      return (
          like<{ respondWith: unknown }>(event) &&
          typeof event.respondWith === "function"
      )
    }
  };

  #navigationTransition = async (event: E) => {
    const router = this;

    const promises: Promise<unknown>[] = [];

    const {
      signal,
    } = event;

    const url: string | URL = getURL(event);

    transition(
        "route",
        (route, match) => route.fn(event, match),
        handleResolve,
        handleReject
    );

    if (promises.length) {
      await Promise.all(promises);
    }

    function transition(
        type: RouteType,
        fn: (route: Route<S, R, E>, match?: URLPatternResult) => unknown,
        resolve = handleResolve,
        reject = handleReject
    ) {
      let isRoute = false;
      resolveRouter(router);
      return isRoute;

      function matchRoute(route: Route<S, R, E>, parentMatch?: URLPatternResult) {
        const { router, pattern } = route;

        let match = parentMatch;

        if (pattern) {
          match = pattern.exec(url);
          if (!match) return;
        }

        if (isRouter<S, R, E>(router)) {
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

      function resolveRouter(router: Router<S, R, E>, match?: URLPatternResult) {
        resolveRoutes(router[Routes][type]);
        resolveRoutes(router[Routes].router);
        function resolveRoutes(routes: Route<S, R, E>[]) {
          for (const route of routes) {
            if (signal?.aborted) break;
            matchRoute(route, match);
          }
        }
      }

    }

    function noop() {}

    function handleResolve(value: unknown) {
      transition(
          "resolve",
          (route, match) => route.fn(value, event, match),
          noop,
          handleReject
      );
    }

    function handleReject(error: unknown) {
      const isRoute = transition(
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
        return event.destination.url;
      } else if (isRequest(event)) {
        return event.request.url;
      } else if (isURL(event)) {
        return event.url;
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



  };
}
