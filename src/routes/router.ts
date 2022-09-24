import { NavigateEvent } from "../spec/navigation";
import { URLPattern } from "urlpattern-polyfill";
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
import {transition} from "./transition";

const Routes = Symbol.for("@virtualstate/navigation/routes/routes");
const Attached = Symbol.for("@virtualstate/navigation/routes/attached");
const Detach = Symbol.for("@virtualstate/navigation/routes/detach");
const Target = Symbol.for("@virtualstate/navigation/routes/target");
const TargetType = Symbol.for("@virtualstate/navigation/routes/target/type");

/**
 * @internal
 */
export function getRouterRoutes<S, R, E extends Event>(router: Router<S, R, E>): RouteRecord<S, R, E> {
  return router[Routes];
}

export function isRouter<S = unknown, R = void | unknown, E extends Event = NavigateEvent<S>>(
    value: unknown
): value is Router<S, R, E> {
  function isRouterLike(value: unknown): value is { [Routes]: unknown } {
    return !!value;
  }
  return isRouterLike(value) && !!value[Routes];
}

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
  };

  #transition = async (event: E) => {
    await transition(this, event);
  };
}
