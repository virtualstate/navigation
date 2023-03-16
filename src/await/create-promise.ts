import {defer} from "../defer";
import {NavigateEvent, Navigation, NavigationEventMap} from "../spec/navigation";
import {getNavigation} from "../get-navigation";
import {isPromise} from "../is";

export function createRepeatingPromise<T>(fn: () => Promise<T>): Promise<T> {
    let promise: Promise<T> | undefined;
    function getPromise() {
        if (promise) return promise;
        const current = promise = fn();
        promise.finally(() => {
            if (promise === current) {
                promise = undefined;
            }
        });
        return promise;
    }
    return {
        get [Symbol.toStringTag]() {
            return "[Promise Repeating]";
        },
        then(onResolve, onReject) {
            return getPromise().then(onResolve, onReject)
        },
        catch(onReject) {
            return getPromise().catch(onReject)
        },
        finally(onFinally) {
            return getPromise().finally(onFinally)
        }
    };
}

export function createNavigationEvent<T extends keyof NavigationEventMap, S, R = void | unknown>(type: T, navigation: Navigation<S, R> = getNavigation()): Promise<NavigationEventMap<S, R>[T]> {
    return createRepeatingPromise(getNavigationPromise);

    function getNavigationPromise() {
        return createNavigationPromise(type, navigation);
    }
}

export type NavigationEventsMap<S, R> = {
    [P in keyof NavigationEventMap]: Promise<NavigationEventMap<S, R>[P]>
}

export function createNavigationEvents<S, R = void | unknown>(navigation: Navigation<S, R> = getNavigation()): NavigationEventsMap<S, R> {
    return {
        navigate: createNavigationEvent("navigate", navigation),
        navigateerror: createNavigationEvent("navigateerror", navigation),
        navigatesuccess: createNavigationEvent("navigatesuccess", navigation),
        entrieschange: createNavigationEvent("entrieschange", navigation),
        currententrychange: createNavigationEvent("currententrychange", navigation)
    }
}

export async function createNavigationPromise<T extends keyof NavigationEventMap, S, R = void | unknown>(
    type: T,
    navigation: Navigation<S, R> = getNavigation(),
    onEventFn?: (event: NavigationEventMap<S, R>[T]) => void | unknown
): Promise<NavigationEventMap<S, R>[T]> {
    const { promise, resolve, reject } = defer<NavigationEventMap<S, R>[T]>();

    navigation.addEventListener(
        type,
        onEvent,
        {
            once: true
        }
    );

    if (type !== "navigate") {
        navigation.addEventListener(
            "navigate",
            onNavigate,
            {
                once: true
            }
        )
    }

    if (type !== "navigateerror") {
        navigation.addEventListener(
            "navigateerror",
            onError,
            {
                once: true
            }
        );
    }

    return promise;

    function removeListeners() {
        navigation.removeEventListener(
            type,
            onEvent
        );
        if (type !== "navigate") {
            navigation.removeEventListener(
                "navigate",
                onNavigate
            )
        }
        if (type !== "navigateerror") {
            navigation.removeEventListener(
                "navigateerror",
                onError
            );
        }
    }

    function onEvent(event: NavigationEventMap<S, R>[T]) {
        removeListeners();
        if (onEventFn) {
            try {
                const result = onEventFn(event);
                if (isPromise(result)) {
                    return result.then(
                        () => resolve(event),
                        reject
                    );
                }
            } catch (error) {
                return reject(error);
            }
        } else if (isNavigateEvent(event)) {
            onNavigate(event);
        }
        resolve(event);
    }

    function isNavigateEvent(event: NavigationEventMap<S, R>[keyof NavigationEventMap]): event is NavigateEvent {
        return event.type === "navigate";
    }

    function onNavigate(event: NavigateEvent) {
        event.intercept();
    }

    function onError(event: NavigationEventMap["navigateerror"]) {
        removeListeners();
        reject(event.error);
    }
}