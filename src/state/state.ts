import {NavigateEvent, Navigation, NavigationHistoryEntry} from "../spec/navigation";
import {getNavigation} from "../get-navigation";
import {Push} from "@virtualstate/promise";
import {Event} from "../event-target";
import {isPromise, ok} from "../is";

export function setState<S>(state: S, navigation: Navigation<S> = getNavigation()): unknown {
    const currentEntryChangePromise = new Promise(
        resolve => {
            navigation.addEventListener(
                "currententrychange",
                resolve,
                { once: true }
            )
        }
    );
    const returned = navigation.updateCurrentEntry({
        state
    });
    const promises = [currentEntryChangePromise];
    if (isPromise(returned)) {
        promises.push(returned);
    }
    return Promise.all(promises);
}

export function getState<S>(navigation: Navigation<S> = getNavigation()) {
    return navigation.currentEntry.getState();
}

const states = new WeakMap<Navigation, AsyncIterable<unknown>>();

export function state<S>(navigation: Navigation<S> = getNavigation()) {

    const existing = states.get(navigation);

    // Using a stable object for a navigation instance
    // allows for this state object to be used in memo'd functions
    if (isExisting(existing)) {
        return existing;
    }

    // Returning an object like this allows callers to bind
    // a navigation to the stateGenerator function, each time
    // a new asyncIterator is created, the transition or currentEntry
    // at that point will be used, meaning that this object
    // too can be freely used as a static source across
    // an application.
    const result: AsyncIterable<S> = {
        [Symbol.asyncIterator]() {
            return stateGenerator(navigation);
        }
    }
    states.set(navigation, result);
    return result;

    function isExisting(existing: AsyncIterable<unknown>): existing is AsyncIterable<S> {
        return !!existing;
    }
}

export async function * stateGenerator<S>(navigation: Navigation<S> = getNavigation()): AsyncIterableIterator<S> {

    let lastState: S | undefined = undefined,
        wasState = false;

    let currentEntry: NavigationHistoryEntry<S> | undefined = navigation.currentEntry;

    if (navigation.transition) {
        currentEntry = await navigation.transition?.finished;
    }

    const push = new Push<S>();

    ok(currentEntry, "Expected a currentEntry");

    pushState();

    navigation.addEventListener("navigate", onNavigate);
    navigation.addEventListener("navigatesuccess", onNavigateSuccess);
    navigation.addEventListener("navigateerror", onNavigateError, { once: true });
    navigation.addEventListener("currententrychange", pushState);

    currentEntry.addEventListener("dispose", close, { once: true });

    yield * push;

    function pushState() {
        if (navigation.currentEntry.id !== currentEntry.id) {
            return close();
        }
        const state = currentEntry.getState()
        if (wasState || typeof state !== "undefined") {
            if (lastState === state) {
                return;
            }
            push.push(state);
            lastState = state;
            wasState = true;
        }
    }

    function onNavigate(event: NavigateEvent) {
        // Indicate that we have intercepted navigation
        // and are using it as a state tracker
        event.intercept?.(Promise.resolve());
        event.transitionWhile?.(Promise.resolve());
    }

    function onNavigateSuccess() {
        if (navigation.currentEntry.id !== currentEntry.id) {
            close();
        }
    }

    function onNavigateError(event: Event) {
        const { error } = event;
        push.throw(error);
    }

    function close() {
        navigation.removeEventListener("navigate", onNavigate);
        navigation.removeEventListener("navigatesuccess", onNavigateSuccess);
        navigation.removeEventListener("navigateerror", onNavigateError);
        navigation.removeEventListener("currententrychange", pushState);
        currentEntry.removeEventListener("dispose", close);
        push.close();
    }

}