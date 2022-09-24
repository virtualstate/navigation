import {URLPattern} from "urlpattern-polyfill";
import {Event} from "../event-target";
import {NavigateEvent} from "../spec/navigation";
import {Router} from "./router";

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

export interface Route<S, R, E extends Event> {
    pattern?: URLPattern;
    fn?: Fn;
    router?: Router<S, R, E>;
}

export type RouteType = "route" | "reject" | "resolve";

export interface RouteRecord<S, R, E extends Event> extends Record<RouteType, Route<S, R, E>[]> {
    router: Route<S, R, E>[];
}

export interface RouterListeningFn<E extends Event> {
    (event: E): RouteFnReturn
}

export interface RouterListenFn<E extends Event = NavigateEvent> {
    (fn: RouterListeningFn<E>): void;
}

export interface EventListenerTarget<E extends Event> {
    addEventListener(type: E["type"], handler: RouterListeningFn<E>): void;
    removeEventListener(type: E["type"], handler: RouterListeningFn<E>): void;
}

export type RouterListenTarget<E extends Event> = RouterListenFn<E> | EventListenerTarget<E>