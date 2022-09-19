import { AbortController } from "./import-abort-controller";
import { InvalidStateError } from "./navigation-errors";
import { WritableProps } from "./util/writable";
import {
  NavigationCurrentEntryChangeEvent,
  NavigationDestination,
  NavigateEvent as NavigateEventPrototype,
  NavigationNavigateOptions as NavigationNavigateOptionsPrototype,
  NavigationNavigationType,
} from "./spec/navigation";
import { NavigationHistoryEntry } from "./navigation-entry";
import {
  NavigationTransition,
  NavigationTransitionAbort,
  NavigationTransitionEntry,
  NavigationTransitionInitialEntries,
  NavigationTransitionKnown,
  NavigationTransitionNavigationType,
  NavigationIntercept,
  InternalNavigationNavigationType,
  Rollback,
} from "./navigation-transition";
import { createEvent } from "./event-target/create-event";
import {getBaseURL} from "./base-url";

export const NavigationFormData = Symbol.for(
  "@virtualstate/navigation/formData"
);
export const NavigationCanIntercept = Symbol.for(
  "@virtualstate/navigation/canIntercept"
);
export const NavigationUserInitiated = Symbol.for(
  "@virtualstate/navigation/userInitiated"
);

export interface NavigationNavigateOptions<S = unknown>
  extends NavigationNavigateOptionsPrototype<S> {
  [NavigationFormData]?: FormData;
  [NavigationCanIntercept]?: boolean;
  [NavigationUserInitiated]?: boolean;
}

export const EventAbortController = Symbol.for(
  "@virtualstate/navigation/event/abortController"
);

export interface AbortControllerEvent {
  [EventAbortController]: AbortController;
}

export interface NavigateEvent<S>
  extends NavigateEventPrototype<S>,
    AbortControllerEvent {}

export interface InternalNavigationNavigateOptions<S>
  extends NavigationNavigateOptions<S> {
  entries?: NavigationHistoryEntry<S>[];
  index?: number;
  known?: Set<NavigationHistoryEntry<S>>;
  navigationType?: NavigationNavigationType;
}

export interface NavigationTransitionContext<S> {
  transition: NavigationTransition<S>;
  options?: InternalNavigationNavigateOptions<S>;
  currentIndex: number;
  known: Set<NavigationHistoryEntry<S>>;
  startTime?: number;
  currentEntry?: NavigationHistoryEntry<S>;
}

export interface NavigationTransitionResult<S> {
  entries: NavigationHistoryEntry<S>[];
  index: number;
  known: Set<NavigationHistoryEntry<S>>;
  destination: NavigationDestination<S>;
  navigate: NavigateEvent<S>;
  currentEntryChange: NavigationCurrentEntryChangeEvent<S>;
  navigationType: InternalNavigationNavigationType;
}

function noop(): void {
  return undefined;
}

function getEntryIndex(
  entries: NavigationHistoryEntry[],
  entry: NavigationHistoryEntry
) {
  const knownIndex = entry.index;
  if (knownIndex !== -1) {
    return knownIndex;
  }
  // TODO find an entry if it has changed id
  return -1;
}

export function createNavigationTransition<S = unknown>(
  context: NavigationTransitionContext<S>
): NavigationTransitionResult<S> {
  const {
    currentIndex,
    options,
    known: initialKnown,
    currentEntry,
    transition,
    transition: {
      [NavigationTransitionInitialEntries]: previousEntries,
      [NavigationTransitionEntry]: entry,
      [NavigationIntercept]: intercept,
    },
  } = context;
  let {
    transition: { [NavigationTransitionNavigationType]: navigationType },
  } = context;

  let resolvedEntries = [...previousEntries];
  const known = new Set(initialKnown);

  let destinationIndex = -1,
    nextIndex = currentIndex;
  if (navigationType === Rollback) {
    const { index } = options ?? { index: undefined };
    if (typeof index !== "number")
      throw new InvalidStateError("Expected index to be provided for rollback");
    destinationIndex = index;
    nextIndex = index;
  } else if (navigationType === "traverse" || navigationType === "reload") {
    destinationIndex = getEntryIndex(previousEntries, entry);
    nextIndex = destinationIndex;
  } else if (navigationType === "replace" && currentIndex !== -1) {
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

  const destination: WritableProps<NavigationDestination<S>> = {
    url: entry.url,
    key: entry.key,
    index: destinationIndex,
    sameDocument: entry.sameDocument,
    getState() {
      return entry.getState();
    },
  };

  let hashChange = false;

  const currentUrlInstance = getBaseURL(currentEntry?.url);
  const destinationUrlInstance = new URL(destination.url);
  const currentHash = currentUrlInstance.hash;
  const destinationHash = destinationUrlInstance.hash;
  // console.log({ currentHash, destinationHash });
  if (currentHash !== destinationHash) {
    const currentUrlInstanceWithoutHash = new URL(
      currentUrlInstance.toString()
    );
    currentUrlInstanceWithoutHash.hash = "";
    const destinationUrlInstanceWithoutHash = new URL(
      destinationUrlInstance.toString()
    );
    destinationUrlInstanceWithoutHash.hash = "";
    hashChange =
      currentUrlInstanceWithoutHash.toString() ===
      destinationUrlInstanceWithoutHash.toString();
    // console.log({ hashChange, currentUrlInstanceWithoutHash: currentUrlInstanceWithoutHash.toString(), before: destinationUrlInstanceWithoutHash.toString() })
  }

  const navigateController = new AbortController();
  const navigate: NavigateEvent<S> = createEvent({
    [EventAbortController]: navigateController,
    signal: navigateController.signal,
    info: undefined,
    ...options,
    canIntercept: options?.[NavigationCanIntercept] ?? true,
    formData: options?.[NavigationFormData] ?? undefined,
    hashChange,
    navigationType:
      options?.navigationType ??
      (typeof navigationType === "string" ? navigationType : "replace"),
    userInitiated: options?.[NavigationUserInitiated] ?? false,
    destination,
    preventDefault: transition[NavigationTransitionAbort].bind(transition),
    intercept,
    type: "navigate",
    scroll: noop
  });
  const currentEntryChange: NavigationCurrentEntryChangeEvent = createEvent({
    from: currentEntry,
    type: "currententrychange",
    navigationType: navigate.navigationType,
    intercept,
  });
  if (navigationType === Rollback) {
    const { entries } = options ?? { entries: undefined };
    if (!entries)
      throw new InvalidStateError(
        "Expected entries to be provided for rollback"
      );
    resolvedEntries = entries;
    resolvedEntries.forEach((entry) => known.add(entry));
  }
  // Default next index is current entries length, aka
  // console.log({ navigationType, givenNavigationType, index: this.#currentIndex, resolvedNextIndex });
  else if (
    navigationType === "replace" ||
    navigationType === "traverse" ||
    navigationType === "reload"
  ) {
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
    currentEntryChange,
    destination,
    navigate,
    navigationType,
  };
}
