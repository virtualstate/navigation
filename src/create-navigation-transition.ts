import { AbortController } from "./import-abort-controller";
import { InvalidStateError } from "./navigation-errors";
import { WritableProps } from "./util/writable";
import {
  NavigationDestination,
  NavigateEvent as NavigateEventPrototype,
  NavigationNavigateOptions as NavigationNavigateOptionsPrototype,
  NavigationNavigationType, NavigationEntriesChangeEventInit,
  NavigationIntercept as NavigationInterceptPrototype
} from "./spec/navigation";
import { NavigationHistoryEntry } from "./navigation-entry";
import {
  NavigationTransition,
  NavigationTransitionAbort,
  NavigationTransitionEntry,
  NavigationTransitionInitialEntries,
  NavigationTransitionNavigationType,
  NavigationIntercept,
  InternalNavigationNavigationType,
  Rollback,
} from "./navigation-transition";
import { createEvent } from "./event-target/create-event";
import {getBaseURL} from "./base-url";
import {defer, Deferred} from "./defer";
import {ok} from "./is";
import {NavigateEvent, NavigationCurrentEntryChangeEvent} from "./events";

export interface PreventDefaultLike {
  preventDefault(): void;
}

export const NavigationFormData = Symbol.for(
    "@virtualstate/navigation/formData"
);
export const NavigationDownloadRequest = Symbol.for(
    "@virtualstate/navigation/downloadRequest"
);
export const NavigationCanIntercept = Symbol.for(
  "@virtualstate/navigation/canIntercept"
);
export const NavigationUserInitiated = Symbol.for(
  "@virtualstate/navigation/userInitiated"
);
export const NavigationOriginalEvent = Symbol.for(
  "@virtualstate/navigation/originalEvent"
);

export interface NavigationNavigateOptions<S = unknown>
  extends NavigationNavigateOptionsPrototype<S> {
  [NavigationFormData]?: FormData;
  [NavigationDownloadRequest]?: string;
  [NavigationCanIntercept]?: boolean;
  [NavigationUserInitiated]?: boolean;
  [NavigationOriginalEvent]?: PreventDefaultLike;
}

export const EventAbortController = Symbol.for(
  "@virtualstate/navigation/event/abortController"
);

export interface AbortControllerEvent {
  [EventAbortController]: AbortController;
}

export interface InternalNavigationNavigateOptions<S = unknown>
  extends NavigationNavigateOptions<S> {
  entries?: NavigationHistoryEntry<S>[];
  index?: number;
  known?: Set<NavigationHistoryEntry<S>>;
  navigationType?: NavigationNavigationType;
}

export interface NavigationTransitionCommitContext<S = unknown> {
  entries: NavigationHistoryEntry<S>[];
  index: number;
  known?: Set<NavigationHistoryEntry<S>>;
  entriesChange?: NavigationEntriesChangeEventInit<S>
}

export interface NavigationTransitionContext<S = unknown> {
  commit(commit: NavigationTransitionCommitContext<S>): Promise<void>;
  transition: NavigationTransition<S>;
  options?: InternalNavigationNavigateOptions<S>;
  currentIndex: number;
  known: Set<NavigationHistoryEntry<S>>;
  startTime?: number;
  currentEntry: NavigationHistoryEntry<S>;
  reportError?(reason: unknown): void;
}

export interface NavigationTransitionResult<S = unknown> {
  entries: NavigationHistoryEntry<S>[];
  index: number;
  known: Set<NavigationHistoryEntry<S>>;
  destination: NavigationDestination<S>;
  navigate: NavigateEvent<S>;
  currentEntryChange: NavigationCurrentEntryChangeEvent<S>;
  navigationType: InternalNavigationNavigationType;
  waitForCommit: Promise<void | unknown>;
  abortController: AbortController;
  commit(): Promise<void> | void;
}

function noop(): void {
  return undefined;
}

function getEntryIndex<S = unknown>(
  entries: NavigationHistoryEntry<S>[],
  entry: NavigationHistoryEntry<S>
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
    commit: transitionCommit,
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
    reportError
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
  } else if (navigationType === "replace") {
    if (currentIndex === -1) {
      navigationType = "push";
      destinationIndex = currentIndex + 1;
      nextIndex = destinationIndex;
    } else {
      destinationIndex = currentIndex;
      nextIndex = currentIndex;
    }
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

  let contextToCommit: NavigationTransitionCommitContext<S>;

  const { resolve: resolveCommit, promise: waitForCommit }: Deferred<unknown> = defer();

  function commit() {
    ok(contextToCommit, "Expected contextToCommit");
    resolveCommit(
        transitionCommit(contextToCommit)
    );
  }

  const abortController = new AbortController();
  const event = new NavigateEvent<S>("navigate", {
    signal: abortController.signal,
    info: undefined,
    ...options,
    canIntercept: options?.[NavigationCanIntercept] ?? true,
    formData: options?.[NavigationFormData] ?? undefined,
    downloadRequest: options?.[NavigationDownloadRequest] ?? undefined,
    hashChange,
    navigationType:
        options?.navigationType ??
        (typeof navigationType === "string" ? navigationType : "replace"),
    userInitiated: options?.[NavigationUserInitiated] ?? false,
    destination,
  })

  const originalEvent = options?.[NavigationOriginalEvent];
  const preventDefault = transition[NavigationTransitionAbort].bind(transition);

  if (originalEvent) {
    const definedEvent: PreventDefaultLike = originalEvent;
    event.intercept = function originalEventIntercept(options: NavigationInterceptPrototype<unknown>) {
      definedEvent.preventDefault();
      return intercept(options);
    }
    event.preventDefault = function originalEventPreventDefault() {
      definedEvent.preventDefault();
      return preventDefault();
    };
  } else {
    event.intercept = intercept;
    event.preventDefault = preventDefault;
  }
  // Enforce that transitionWhile and intercept match
  event.transitionWhile = event.intercept;
  event.commit = commit;
  if (reportError) {
    event.reportError = reportError;
  }
  event.scroll = noop;

  if (originalEvent) {
    event.originalEvent = originalEvent;
  }

  const currentEntryChange = new NavigationCurrentEntryChangeEvent("currententrychange", {
    from: currentEntry,
    navigationType: event.navigationType,
  });

  let updatedEntries: NavigationHistoryEntry<S>[] = [],
      removedEntries: NavigationHistoryEntry<S>[] = [],
      addedEntries: NavigationHistoryEntry<S>[] = [];

  const previousKeys = previousEntries.map(entry => entry.key);

  if (navigationType === Rollback) {
    const { entries } = options ?? { entries: undefined };
    if (!entries)
      throw new InvalidStateError(
        "Expected entries to be provided for rollback"
      );
    resolvedEntries = entries;
    resolvedEntries.forEach((entry) => known.add(entry));

    const keys = resolvedEntries.map(entry => entry.key);
    removedEntries = previousEntries.filter(entry => !keys.includes(entry.key));
    addedEntries = resolvedEntries.filter(entry => !previousKeys.includes(entry.key));
  }
  // Default next index is current entries length, aka
  // console.log({ navigationType, givenNavigationType, index: this.#currentIndex, resolvedNextIndex });
  else if (
    navigationType === "replace" ||
    navigationType === "traverse" ||
    navigationType === "reload"
  ) {
    resolvedEntries[destination.index] = entry;

    if (navigationType !== "traverse") {
      updatedEntries.push(entry);
    }

    if (navigationType === "replace") {
      resolvedEntries = resolvedEntries.slice(0, destination.index + 1);
    }

    const keys = resolvedEntries.map(entry => entry.key);
    removedEntries = previousEntries.filter(entry => !keys.includes(entry.key));
    if (previousKeys.includes(entry.id)) {
      addedEntries = [entry];
    }
  } else if (navigationType === "push") {
    let removed = false;
    // Trim forward, we have reset our stack
    if (resolvedEntries[destination.index]) {
      // const before = [...this.#entries];
      resolvedEntries = resolvedEntries.slice(0, destination.index);
      // console.log({ before, after: [...this.#entries]})
      removed = true;
    }
    resolvedEntries.push(entry);
    addedEntries = [entry];
    if (removed) {
      const keys = resolvedEntries.map(entry => entry.key);
      removedEntries = previousEntries.filter(entry => !keys.includes(entry.key));
    }
  }

  known.add(entry);

  let entriesChange: NavigationEntriesChangeEventInit<S> | undefined = undefined;

  if (updatedEntries.length || addedEntries.length || removedEntries.length) {
    entriesChange = {
      updatedEntries,
      addedEntries,
      removedEntries
    };
  }

  contextToCommit = {
    entries: resolvedEntries,
    index: nextIndex,
    known,
    entriesChange
  };

  return {
    entries: resolvedEntries,
    known,
    index: nextIndex,
    currentEntryChange,
    destination,
    navigate: event,
    navigationType,
    waitForCommit,
    commit,
    abortController
  };
}
