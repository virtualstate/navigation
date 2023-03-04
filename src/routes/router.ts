import { NavigateEvent } from "../spec/navigation";
import {isURLPatternPlainPathname, isURLPatternStringPlain, URLPattern} from "./url-pattern";
import { Event } from "../event-target";
import { like } from "../is";
import {
  ErrorFn,
  PatternErrorFn,
  PatternRouteFn,
  PatternThenFn,
  RouteFn,
  RouteRecord,
  RouterListenTarget,
  ThenFn
} from "./types";
import {transitionEvent} from "./transition";

const Routes = Symbol.for("@virtualstate/navigation/routes/routes");
const Attached = Symbol.for("@virtualstate/navigation/routes/attached");
const Detach = Symbol.for("@virtualstate/navigation/routes/detach");
const Target = Symbol.for("@virtualstate/navigation/routes/target");
const TargetType = Symbol.for("@virtualstate/navigation/routes/target/type");

/**
 * @internal
 */
export function getRouterRoutes<E extends Event, R>(router: Router<E, R>): RouteRecord<E, R> {
  return router[Routes];
}

export function isRouter<E extends Event = NavigateEvent, R = void | unknown>(
    value: unknown
): value is Router<E, R> {
  function isRouterLike(value: unknown): value is { [Routes]: unknown } {
    return !!value;
  }
  return isRouterLike(value) && !!value[Routes];
}

function getPatternString(pattern?: string | URLPattern): string | undefined {
  if (!pattern) return undefined;
  if (typeof pattern === "string") {
    if (isURLPatternStringPlain(pattern)) {
      return pattern;
    } else {
      return undefined;
    }
  }
  if (isURLPatternPlainPathname(pattern)) {
    return pattern.pathname;
  }
  return undefined;
}

function getPattern(pattern?: string | URLPattern): URLPattern {
  if (!pattern) return undefined;
  if (typeof pattern !== "string") {
    return pattern;
  }
  return new URLPattern({ pathname: pattern });
}

export class Router<
    E extends Event = NavigateEvent,
    R = void | unknown,
    T extends RouterListenTarget<E> = RouterListenTarget<E>
> {
  [Routes]: RouteRecord<E, R> = {
    router: [],
    route: [],
    reject: [],
    resolve: [],
  };
  [Attached] = new Set<Router<E, R>>();
  [Target]: T;
  [TargetType]: E["type"];

  private listening = false;

  constructor(target?: T, type?: E["type"]) {

    this[Target] = target;
    this[TargetType] = type;

    // Catch use override types with
    // arrow functions so need to bind manually
    this.routes = this.routes.bind(this);
    this.route = this.route.bind(this);
    this.then = this.then.bind(this);
    this.catch = this.catch.bind(this);
  }

  routes(pattern: string | URLPattern, router: Router<E, R>): this;
  routes(router: Router<E, R>): this;
  routes(...args: [string | URLPattern, Router<E, R>] | [Router<E, R>]): this;
  routes(...args: [string | URLPattern, Router<E, R>] | [Router<E, R>]): this {
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
      string: getPatternString(pattern),
      pattern: getPattern(pattern),
      router,
    });
    router[Attached].add(this);
    this.#init();
    return this;
  }

  then(pattern: string | URLPattern, fn: PatternThenFn<E, R>): this;
  then(pattern: string | URLPattern, fn: PatternThenFn<E, R>, errorFn: PatternErrorFn<E>): this;
  then(fn: ThenFn<E, R>): this;
  then(fn: ThenFn<E, R>, catchFn: ErrorFn<E>): this;
  then(
      ...args: [string | URLPattern, PatternThenFn<E, R>] | [string | URLPattern, PatternThenFn<E, R>, PatternErrorFn<E>] | [ThenFn<E, R>] | [ThenFn<E, R>, ErrorFn<E>]
  ): this;
  then(
      ...args: [string | URLPattern, PatternThenFn<E, R>] | [string | URLPattern, PatternThenFn<E, R>, PatternErrorFn<E>] | [ThenFn<E, R>] | [ThenFn<E, R>, ErrorFn<E>]
  ): this {
    if (args.length === 1) {
      const [fn] = args;
      this[Routes].resolve.push({
        fn,
      });
    } else if (args.length === 2 && isThenError(args)) {

      const [fn, errorFn] = args;
      this[Routes].resolve.push({
        fn,
      });
      this[Routes].reject.push({
        fn: errorFn,
      });
    } else {
      const [pattern, fn, errorFn] = args;
      this[Routes].resolve.push({
        string: getPatternString(pattern),
        pattern: getPattern(pattern),
        fn,
      });
      if (errorFn) {
        this[Routes].reject.push({
          string: getPatternString(pattern),
          pattern: getPattern(pattern),
          fn: errorFn
        })
      }
    }
    // No init for just then
    return this;

    function isThenError(args: [unknown, unknown]): args is [ThenFn<E, R>, ErrorFn<E>] {
      const [left, right] = args;
      return typeof left === "function" && typeof right === "function";
    }
  }

  catch(pattern: string | URLPattern, fn: PatternErrorFn<E>): this;
  catch(fn: ErrorFn<E>): this;
  catch(...args: [string | URLPattern, PatternErrorFn<E>] | [ErrorFn<E>]): this;
  catch(
      ...args: [string | URLPattern, PatternErrorFn<E>] | [ErrorFn<E>]
  ): this {
    if (args.length === 1) {
      const [fn] = args;
      this[Routes].reject.push({
        fn,
      });
    } else {
      const [pattern, fn] = args;
      this[Routes].reject.push({
        string: getPatternString(pattern),
        pattern: getPattern(pattern),
        fn,
      });
    }
    // No init for just catch
    return this;
  }

  route(pattern: string | URLPattern, fn: PatternRouteFn<E, R>): this;
  route(fn: RouteFn<E, R>): this;
  route(
      ...args: [string | URLPattern, PatternRouteFn<E, R>] | [RouteFn<E, R>]
  ): this;
  route(
      ...args: [string | URLPattern, PatternRouteFn<E, R>] | [RouteFn<E, R>]
  ): this {
    if (args.length === 1) {
      const [fn] = args;
      this[Routes].route.push({
        fn,
      });
    } else {
      const [pattern, fn] = args;
      this[Routes].route.push({
        string: getPatternString(pattern),
        pattern: getPattern(pattern),
        fn,
      });
    }
    this.#init();
    return this;
  }

  [Detach](router: Router<E, R>) {
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
      if (isRouter<E, R>(attached)) {
        attached[Detach](this);
      }
    }
    this[Attached] = new Set();
  };

  #init = () => {
    if (this.listening) {
      return;
    }
    const target = this[Target];
    if (!target) return;
    this.listening = true;
    if (typeof target === "function") {
      return target(this.#event);
    }
    const type = this[TargetType] ?? "navigate";
    target.addEventListener(type, this.#event);
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
    target.removeEventListener(type, this.#event);
  };

  #event = (event: E) => {
    if (!event.canIntercept) return;

    if (isIntercept(event)) {
      event.intercept(this.#transition(event));
    } else if (isTransitionWhile(event)) {
      event.transitionWhile(this.#transition(event));
    } else if (isWaitUntil(event)) {
      event.waitUntil(this.#transition(event));
    } else if (isRespondWith(event)) {
      event.respondWith(this.#transition(event));
    } else {
      return this.#transition(event);
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

    function isWaitUntil(event: E): event is E & { waitUntil(promise: Promise<unknown>): void } {
      return (
          like<{ waitUntil: unknown }>(event) &&
          typeof event.waitUntil === "function"
      )
    }
  };

  #transition = async (event: E): Promise<void> => {
    return transitionEvent(this, event);
  };
}
