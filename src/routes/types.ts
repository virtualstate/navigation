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

export interface RouteFn<E extends Event = NavigateEvent, R = void | unknown> {
    (event: E, match?: URLPatternResult): RouteFnReturn<R>;
}

export interface ErrorFn<E extends Event = NavigateEvent> {
    (
        error: unknown,
        event: E,
        match?: URLPatternResult
    ): RouteFnReturn;
}

export interface PatternErrorFn<E extends Event = NavigateEvent> {
    (
        error: unknown,
        event: E,
        match: URLPatternResult
    ): RouteFnReturn;
}

export interface ThenFn<E extends Event = NavigateEvent, R = void | unknown> {
    (value: R, event: E, match?: URLPatternResult): RouteFnReturn;
}

export interface PatternThenFn<E extends Event = NavigateEvent, R = void | unknown> {
    (value: R, event: E, match: URLPatternResult): RouteFnReturn;
}

export interface PatternRouteFn<E extends Event = NavigateEvent, R = void | unknown> {
    (event: E, match: URLPatternResult): RouteFnReturn<R>;
}

export interface Route<E extends Event = Event, R = unknown> {
    string?: string;
    pattern?: URLPattern;
    fn?: Fn;
    router?: Router<E, R>;
}

export type RouteType = "route" | "reject" | "resolve";

export interface RouteRecord<E extends Event, R> extends Record<RouteType, Route<E, R>[]> {
    router: Route<E, R>[];
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