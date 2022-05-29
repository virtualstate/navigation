import {AbortController} from "./import-abort-controller";
import {InvalidStateError} from "./navigation-errors";
import {WritableProps} from "./util/writable";
import {
    NavigationCurrentEntryChangeEvent,
    NavigationDestination,
    NavigateEvent as NavigateEventPrototype,
    NavigationNavigateOptions as NavigationNavigateOptionsPrototype,
    NavigationNavigationType
} from "./spec/navigation";
import {NavigationHistoryEntry} from "./navigation-entry";
import {
    NavigationTransition, NavigationTransitionAbort,
    NavigationTransitionEntry,
    NavigationTransitionInitialEntries, NavigationTransitionKnown,
    NavigationTransitionNavigationType, NavigationTransitionWhile,
    InternalNavigationNavigationType,
    Rollback
} from "./navigation-transition";
import {createEvent} from "./event-target/create-event";

export const NavigationFormData = Symbol.for("@virtualstate/navigation/formData");
export const NavigationCanTransition = Symbol.for("@virtualstate/navigation/canTransition");
export const NavigationUserInitiated = Symbol.for("@virtualstate/navigation/userInitiated");

const baseUrl = "https://html.spec.whatwg.org/";

export interface NavigationNavigateOptions extends NavigationNavigateOptionsPrototype {
    [NavigationFormData]?: FormData;
    [NavigationCanTransition]?: boolean;
    [NavigationUserInitiated]?: boolean;
}

export const EventAbortController = Symbol.for("@virtualstate/navigation/event/abortController");

export interface AbortControllerEvent {
    [EventAbortController]: AbortController
}

export interface NavigateEvent extends NavigateEventPrototype, AbortControllerEvent {

}

export interface InternalNavigationNavigateOptions extends NavigationNavigateOptions {
    entries?: NavigationHistoryEntry[];
    index?: number;
    known?: Set<NavigationHistoryEntry>;
    navigationType?: NavigationNavigationType;
}

export interface NavigationTransitionContext {
    transition: NavigationTransition;
    options?: InternalNavigationNavigateOptions;
    currentIndex: number;
    known: Set<NavigationHistoryEntry>;
    startTime?: number;
    currentEntry?: NavigationHistoryEntry;
}

export interface NavigationTransitionResult {
    entries: NavigationHistoryEntry[];
    index: number;
    known: Set<NavigationHistoryEntry>;
    destination: NavigationDestination;
    navigate: NavigateEvent;
    currentChange: NavigationCurrentEntryChangeEvent;
    navigationType: InternalNavigationNavigationType;
}

function getEntryIndex(entries: NavigationHistoryEntry[], entry: NavigationHistoryEntry) {
    const knownIndex = entry.index;
    if (knownIndex !== -1) {
        return knownIndex;
    }
    // TODO find an entry if it has changed id
    return -1;
}

export function createNavigationTransition(context: NavigationTransitionContext): NavigationTransitionResult {
    const {
        currentIndex,
        options,
        known: initialKnown,
        currentEntry,
        transition,
        transition: {
            [NavigationTransitionInitialEntries]: previousEntries,
            [NavigationTransitionEntry]: entry,
            [NavigationTransitionWhile]: transitionWhile
        }
    } = context;
    let {
        transition: {
            [NavigationTransitionNavigationType]: navigationType
        }
    } = context;

    let resolvedEntries = [...previousEntries];
    const known = new Set(initialKnown);

    let destinationIndex = -1,
        nextIndex = currentIndex;
    if (navigationType === Rollback) {
        const { index } = options ?? { index: undefined };
        if (typeof index !== "number") throw new InvalidStateError("Expected index to be provided for rollback");
        destinationIndex = index;
        nextIndex = index;
    } else if (navigationType === "traverse" || navigationType === "reload") {
        destinationIndex = getEntryIndex(previousEntries, entry);
        nextIndex = destinationIndex;
    } else if ((navigationType === "replace") && currentIndex !== -1) {
        destinationIndex = currentIndex;
        nextIndex = currentIndex;
    } else if (navigationType === "replace") {
        navigationType = "push";
        destinationIndex = currentIndex + 1;
        nextIndex = destinationIndex;
    } else {
        destinationIndex = currentIndex + 1;
        nextIndex = destinationIndex;
    }

    if (typeof destinationIndex !== "number" || destinationIndex === -1) {
        throw new InvalidStateError("Could not resolve next index");
    }

    // console.log({ navigationType, entry, options });

    if (!entry.url) {
        console.trace({ navigationType, entry, options });
        throw new InvalidStateError("Expected entry url");
    }

    const destination: WritableProps<NavigationDestination> = {
        url: entry.url,
        key: entry.key,
        index: destinationIndex,
        sameDocument: entry.sameDocument,
        getState() {
            return entry.getState()
        }
    };

    let hashChange = false;

    const currentUrlInstance = new URL(currentEntry?.url ?? "/", baseUrl);
    const destinationUrlInstance = new URL(destination.url, baseUrl);
    const currentHash = currentUrlInstance.hash;
    const destinationHash = destinationUrlInstance.hash;
    if (currentHash !== destinationHash) {
        const currentUrlInstanceWithoutHash = new URL(currentUrlInstance.toString());
        currentUrlInstanceWithoutHash.hash = "";
        const destinationUrlInstanceWithoutHash = new URL(destinationUrlInstance.toString());
        destinationUrlInstanceWithoutHash.hash = "";
        hashChange = currentUrlInstanceWithoutHash.toString() === destinationUrlInstanceWithoutHash.toString();
    }

    const navigateController = new AbortController();
    const navigate: NavigateEvent = createEvent({
        [EventAbortController]: navigateController,
        signal: navigateController.signal,
        info: undefined,
        ...options,
        canTransition: options?.[NavigationCanTransition] ?? true,
        formData: options?.[NavigationFormData] ?? undefined,
        hashChange,
        navigationType: options?.navigationType ?? (
            typeof navigationType === "string" ? navigationType : "replace"
        ),
        userInitiated: options?.[NavigationUserInitiated] ?? false,
        destination,
        preventDefault: transition[NavigationTransitionAbort].bind(transition),
        transitionWhile,
        type: "navigate"
    });
    const currentChange: NavigationCurrentEntryChangeEvent = createEvent({
        from: currentEntry,
        type: "currentchange",
        navigationType: navigate.navigationType,
        transitionWhile
    });
    if (navigationType === Rollback) {
        const { entries } = options ?? { entries: undefined };
        if (!entries) throw new InvalidStateError("Expected entries to be provided for rollback");
        resolvedEntries = entries;
        resolvedEntries.forEach(entry => known.add(entry));
    } else
        // Default next index is current entries length, aka
        // console.log({ navigationType, givenNavigationType, index: this.#currentIndex, resolvedNextIndex });
    if (navigationType === "replace" || navigationType === "traverse" || navigationType === "reload") {
        resolvedEntries[destination.index] = entry;
        if (navigationType === "replace") {
            resolvedEntries = resolvedEntries.slice(0, destination.index + 1);
        }
    } else if (navigationType === "push") {
        // Trim forward, we have reset our stack
        if (resolvedEntries[destination.index]) {
            // const before = [...this.#entries];
            resolvedEntries = resolvedEntries.slice(0, destination.index);
            // console.log({ before, after: [...this.#entries]})
        }
        resolvedEntries.push(entry);
    }
    known.add(entry);
    return {
        entries: resolvedEntries,
        known,
        index: nextIndex,
        currentChange,
        destination,
        navigate,
        navigationType
    };
}