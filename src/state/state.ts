import {Navigation} from "../spec/navigation";
import {getNavigation} from "../get-navigation";
import {Push} from "@virtualstate/promise";
import {Event} from "../event-target";
import {ok} from "../is";

export function setState<S>(state: S, navigation: Navigation<S> = getNavigation()) {
    navigation.updateCurrentEntry({
        state
    });
}

export function getState<S>(navigation: Navigation<S> = getNavigation()) {
    return navigation.currentEntry.getState();
}

export async function * state<S>(navigation: Navigation<S> = getNavigation()) {

    let lastState: S | undefined = undefined,
        wasState = false;

    // Wait for the initial transition to finish until we watch additional state
    const finishedEntry = await navigation?.transition.finished

    const push = new Push<S>();

    const currentEntry = finishedEntry ?? navigation.currentEntry;

    ok(currentEntry, "Expected a currentEntry");

    pushState();

    navigation.addEventListener("navigateerror", onNavigateError, { once: true });
    navigation.addEventListener("currententrychange", pushState);

    currentEntry.addEventListener("dispose", close, { once: true });

    yield * push;

    function pushState() {
        if (navigation.currentEntry.key !== currentEntry.key) {
            return;
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

    function onNavigateError(event: Event) {
        const { error } = event;
        push.throw(error);
    }

    function close() {
        navigation.removeEventListener("navigateerror", onNavigateError);
        navigation.removeEventListener("currententrychange", pushState);
        currentEntry.removeEventListener("dispose", close);

        // Note that this is breaking the state! Not closing
        // If the state was not read by the time this is called
        // it may not be available
        //
        // Retaining currentEntry and using
        // currentEntry.getState() can always get
        // the final state
        push.break();
    }

}