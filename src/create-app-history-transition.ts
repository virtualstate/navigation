import AbortController from "abort-controller";
import {InvalidStateError} from "./app-history-errors";
import {WritableProps} from "./util/writable";
import {
    AppHistoryCurrentChangeEvent,
    AppHistoryDestination,
    AppHistoryNavigateEvent as AppHistoryNavigateEventPrototype,
    AppHistoryNavigateOptions as AppHistoryNavigateOptionsPrototype,
    AppHistoryNavigationType
} from "./spec/app-history";
import {AppHistoryEntry} from "./app-history-entry";
import {
    AppHistoryTransition, AppHistoryTransitionAbort,
    AppHistoryTransitionEntry,
    AppHistoryTransitionInitialEntries, AppHistoryTransitionKnown,
    AppHistoryTransitionNavigationType, AppHistoryTransitionWhile,
    InternalAppHistoryNavigationType,
    Rollback
} from "./app-history-transition";
import {createEvent} from "./event-target/create-event";

export const AppHistoryFormData = Symbol.for("@virtualstate/app-history/formData");
export const AppHistoryCanTransition = Symbol.for("@virtualstate/app-history/canTransition");
export const AppHistoryUserInitiated = Symbol.for("@virtualstate/app-history/userInitiated");

const baseUrl = "https://html.spec.whatwg.org/";

export interface AppHistoryNavigateOptions extends AppHistoryNavigateOptionsPrototype {
    [AppHistoryFormData]?: FormData;
    [AppHistoryCanTransition]?: boolean;
    [AppHistoryUserInitiated]?: boolean;
}

export const EventAbortController = Symbol.for("@virtualstate/app-history/event/abortController");

export interface AbortControllerEvent {
    [EventAbortController]: AbortController
}

export interface AppHistoryNavigateEvent extends AppHistoryNavigateEventPrototype, AbortControllerEvent {

}

export interface InternalAppHistoryNavigateOptions extends AppHistoryNavigateOptions {
    entries?: AppHistoryEntry[];
    index?: number;
    known?: Set<AppHistoryEntry>;
    navigationType?: AppHistoryNavigationType;
}

export interface AppHistoryTransitionContext {
    transition: AppHistoryTransition;
    options?: InternalAppHistoryNavigateOptions;
    currentIndex: number;
    known: Set<AppHistoryEntry>;
    startTime?: number;
    current?: AppHistoryEntry;
}

export interface AppHistoryTransitionResult {
    entries: AppHistoryEntry[];
    index: number;
    known: Set<AppHistoryEntry>;
    destination: AppHistoryDestination;
    navigate: AppHistoryNavigateEvent;
    currentChange: AppHistoryCurrentChangeEvent;
    navigationType: InternalAppHistoryNavigationType;
}

function getEntryIndex(entries: AppHistoryEntry[], entry: AppHistoryEntry) {
    const knownIndex = entry.index;
    if (knownIndex !== -1) {
        return knownIndex;
    }
    // TODO find an entry if it has changed id
    return -1;
}

export function createAppHistoryTransition(context: AppHistoryTransitionContext): AppHistoryTransitionResult {
    const {
        currentIndex,
        options,
        known: initialKnown,
        current,
        transition,
        transition: {
            [AppHistoryTransitionInitialEntries]: previousEntries,
            [AppHistoryTransitionEntry]: entry,
            [AppHistoryTransitionWhile]: transitionWhile
        }
    } = context;
    let {
        transition: {
            [AppHistoryTransitionNavigationType]: navigationType
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

    const destination: WritableProps<AppHistoryDestination> = {
        url: entry.url,
        key: entry.key,
        index: destinationIndex,
        sameDocument: entry.sameDocument,
        getState() {
            return entry.getState()
        }
    };

    let hashChange = false;

    const currentUrlInstance = new URL(current?.url ?? "/", baseUrl);
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
    const navigate: AppHistoryNavigateEvent = createEvent({
        [EventAbortController]: navigateController,
        signal: navigateController.signal,
        info: undefined,
        ...options,
        canTransition: options?.[AppHistoryCanTransition] ?? true,
        formData: options?.[AppHistoryFormData] ?? undefined,
        hashChange,
        navigationType: options?.navigationType ?? (
            typeof navigationType === "string" ? navigationType : "replace"
        ),
        userInitiated: options?.[AppHistoryUserInitiated] ?? false,
        destination,
        preventDefault: transition[AppHistoryTransitionAbort].bind(transition),
        transitionWhile,
        type: "navigate"
    });
    const currentChange: AppHistoryCurrentChangeEvent = createEvent({
        from: current,
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