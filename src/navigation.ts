import {
  NavigationHistoryEntry, NavigationHistoryEntryFn, NavigationHistoryEntryGetStateFn,
  NavigationHistoryEntryInit,
  NavigationHistoryEntryKnownAs,
  NavigationHistoryEntryNavigationType, NavigationHistoryEntrySerialized,
  NavigationHistoryEntrySetState,
} from "./navigation-entry";
import {
  Navigation as NavigationPrototype,
  NavigationEventMap,
  NavigationReloadOptions,
  NavigationResult,
  NavigationUpdateCurrentOptions,
  NavigationTransition as NavigationTransitionPrototype,
  NavigationNavigationOptions,
  NavigationNavigationType, NavigationEntriesChangeEvent
} from "./spec/navigation";
import { NavigationEventTarget } from "./navigation-event-target";
import { InvalidStateError } from "./navigation-errors";
import { EventTargetListeners } from "./event-target";
import {
  NavigationTransition,
  NavigationTransitionEntry,
  NavigationTransitionError,
  NavigationTransitionFinally,
  NavigationTransitionStart,
  NavigationTransitionInitialEntries,
  NavigationTransitionInitialIndex,
  NavigationTransitionKnown,
  NavigationTransitionNavigationType,
  NavigationTransitionParentEventTarget,
  NavigationTransitionPromises,
  NavigationTransitionWait,
  InternalNavigationNavigationType,
  Rollback,
  Unset,
  NavigationIntercept,
  NavigationTransitionStartDeadline,
  NavigationTransitionCommit,
  NavigationTransitionFinish,
  NavigationTransitionAbort,
  NavigationTransitionIsOngoing,
  NavigationTransitionFinishedDeferred,
  NavigationTransitionCommittedDeferred,
  NavigationTransitionIsAsync,
  NavigationTransitionInterceptOptionsCommit,
  NavigationTransitionCommitIsManual,
  NavigationTransitionRejected,
} from "./navigation-transition";
import {
  NavigationTransitionResult,
  createNavigationTransition,
  EventAbortController,
  InternalNavigationNavigateOptions,
  NavigationNavigateOptions, NavigationTransitionCommitContext,
} from "./create-navigation-transition";
import { createEvent } from "./event-target/create-event";
import { getBaseURL } from "./base-url";
import {isPromise, isPromiseRejectedResult} from "./is";
import {NavigationCurrentEntryChangeEvent} from "./events";

export * from "./spec/navigation";

export interface NavigationOptions<S = unknown> {
  baseURL?: URL | string;
  getState?: NavigationHistoryEntryGetStateFn<S>
  setState?: NavigationHistoryEntryFn<S>
  disposeState?: NavigationHistoryEntryFn<S>
  entries?: NavigationHistoryEntrySerialized<S>[];
  currentIndex?: number;
  currentKey?: string;
}

export const NavigationSetOptions = Symbol.for("@virtualstate/navigation/setOptions");
export const NavigationSetEntries = Symbol.for("@virtualstate/navigation/setEntries");
export const NavigationSetCurrentIndex = Symbol.for("@virtualstate/navigation/setCurrentIndex");
export const NavigationSetCurrentKey = Symbol.for("@virtualstate/navigation/setCurrentKey");
export const NavigationGetState = Symbol.for("@virtualstate/navigation/getState");
export const NavigationSetState = Symbol.for("@virtualstate/navigation/setState");
export const NavigationDisposeState = Symbol.for("@virtualstate/navigation/disposeState");

export function isNavigationNavigationType(value: unknown): value is NavigationNavigationType {
  return (
      value === "reload" ||
      value === "push" ||
      value === "replace" ||
      value === "traverse"
  );
}

export class Navigation<S = unknown, R = unknown | void>
  extends NavigationEventTarget<NavigationEventMap<S, R>>
  implements NavigationPrototype<S, R>
{
  // Should be always 0 or 1
  #transitionInProgressCount = 0;
  // #activePromise?: Promise<void> = undefined;

  #entries: NavigationHistoryEntry<S>[] = [];
  #known = new Set<NavigationHistoryEntry<S>>();
  #currentIndex = -1;
  #activeTransition?: NavigationTransition<S>;

  #knownTransitions = new WeakSet();
  #baseURL: string | URL = "";

  #initialEntry: NavigationHistoryEntry<S> | undefined = undefined;

  #options: NavigationOptions<S> | undefined = undefined;

  get canGoBack() {
    return !!this.#entries[this.#currentIndex - 1];
  }

  get canGoForward() {
    return !!this.#entries[this.#currentIndex + 1];
  }

  get currentEntry(): NavigationHistoryEntry<S> {
    if (this.#currentIndex === -1) {
      if (!this.#initialEntry) {
        this.#initialEntry = new NavigationHistoryEntry<S>({
          getState: this[NavigationGetState],
          navigationType: "push",
          index: -1,
          sameDocument: false,
          url: this.#baseURL.toString()
        });
      }

      return this.#initialEntry;
    }
    return this.#entries[this.#currentIndex];
  }

  get transition(): NavigationTransitionPrototype | undefined {
    const transition = this.#activeTransition;
    // Never let an aborted transition leak, it doesn't need to be accessed any more
    return transition?.signal.aborted ? undefined : transition;
  }

  constructor(options: NavigationOptions<S> = {}) {
    super();
    this[NavigationSetOptions](options);
  }

  [NavigationSetOptions](options: NavigationOptions<S>) {
    this.#options = options;
    this.#baseURL = getBaseURL(options?.baseURL);
    this.#entries = [];
    if (options.entries) {
      this[NavigationSetEntries](options.entries);
    }
    if (options.currentKey) {
      this[NavigationSetCurrentKey](options.currentKey);
    } else if (typeof options.currentIndex === "number") {
      this[NavigationSetCurrentIndex](options.currentIndex)
    }
  }

  /**
   * Set the current entry key without any lifecycle eventing
   *
   * This would be more exact than providing an index
   * @param key
   */
  [NavigationSetCurrentKey](key: string) {
    const index = this.#entries.findIndex(
        entry => entry.key === key
    );
    // If the key can't be found, becomes a no-op
    if (index === -1) return;
    this.#currentIndex = index;
  }

  /**
   * Set the current entry index without any lifecycle eventing
   * @param index
   */
  [NavigationSetCurrentIndex](index: number) {
    if (index <= -1) return;
    if (index >= this.#entries.length) return;
    this.#currentIndex = index;
  }

  /**
   * Set the entries available without any lifecycle eventing
   * @param entries
   */
  [NavigationSetEntries](entries: NavigationHistoryEntrySerialized<S>[]) {
    this.#entries = entries.map(
        ({ key, url, navigationType, state, sameDocument }, index) => new NavigationHistoryEntry<S>({
          getState: this[NavigationGetState],
          navigationType: isNavigationNavigationType(navigationType) ? navigationType : "push",
          sameDocument: sameDocument ?? true,
          index,
          url,
          key,
          state
        })
    );
    if (this.#currentIndex === -1 && this.#entries.length) {
      // Initialise, even if its not the one that was expected
      this.#currentIndex = 0;
    }
  }

  [NavigationGetState] = (entry: NavigationHistoryEntry<S>): S | undefined => {
    return this.#options?.getState?.(entry) ?? undefined;
  }

  [NavigationSetState] = (entry: NavigationHistoryEntry<S>) => {
    return this.#options?.setState?.(entry);
  }

  [NavigationDisposeState] = (entry: NavigationHistoryEntry<S>) => {
    return this.#options?.disposeState?.(entry);
  }

  back(options?: NavigationNavigationOptions): NavigationResult<S> {
    if (!this.canGoBack) throw new InvalidStateError("Cannot go back");
    const entry = this.#entries[this.#currentIndex - 1];
    return this.#pushEntry(
      "traverse",
      this.#cloneNavigationHistoryEntry(entry, {
        ...options,
        navigationType: "traverse",
      })
    );
  }

  entries(): NavigationHistoryEntry<S>[] {
    return [...this.#entries];
  }

  forward(options?: NavigationNavigationOptions): NavigationResult<S> {
    if (!this.canGoForward) throw new InvalidStateError();
    const entry = this.#entries[this.#currentIndex + 1];
    return this.#pushEntry(
      "traverse",
      this.#cloneNavigationHistoryEntry(entry, {
        ...options,
        navigationType: "traverse",
      })
    );
  }

  /**
  /**
   * @deprecated use traverseTo
   */
  goTo(key: string, options?: NavigationNavigateOptions): NavigationResult<R> {
    return this.traverseTo(key, options);
  }

  traverseTo(key: string, options?: NavigationNavigationOptions): NavigationResult<S> {
    const found = this.#entries.find((entry) => entry.key === key);
    if (found) {
      return this.#pushEntry(
        "traverse",
        this.#cloneNavigationHistoryEntry(found, {
          ...options,
          navigationType: "traverse",
        })
      );
    }
    throw new InvalidStateError();
  }

  #isSameDocument = (url: string) => {
    function isSameOrigins(a: URL, b: URL) {
      return a.origin === b.origin;
    }
    const currentEntryUrl = this.currentEntry?.url;
    if (!currentEntryUrl) return true;
    return isSameOrigins(
        new URL(currentEntryUrl),
        new URL(url)
    );
  }

  navigate(
    url: string,
    options?: NavigationNavigateOptions<S>
  ): NavigationResult {
    let baseURL = this.#baseURL
    if (this.currentEntry?.url) {
      // This allows use to use relative
      baseURL = this.currentEntry?.url;
    }
    const nextUrl = new URL(url, baseURL).toString();
    let navigationType: NavigationNavigationType = "push"
    if (options?.history === "push" || options?.history === "replace") {
        navigationType = options?.history;
    }
    const entry = this.#createNavigationHistoryEntry({
      getState: this[NavigationGetState],
      url: nextUrl,
      ...options,
      sameDocument: this.#isSameDocument(nextUrl),
      navigationType,
    });
    return this.#pushEntry(navigationType, entry, undefined, options);
  }

  #cloneNavigationHistoryEntry = (
    entry?: NavigationHistoryEntry<S>,
    options?: InternalNavigationNavigateOptions<S>
  ): NavigationHistoryEntry<S> => {
    return this.#createNavigationHistoryEntry({
      ...entry,
      getState: this[NavigationGetState],
      index: entry?.index ?? undefined,
      state: options?.state ?? entry?.getState<S>(),
      navigationType:
        entry?.[NavigationHistoryEntryNavigationType] ??
        (typeof options?.navigationType === "string"
          ? options.navigationType
          : "replace"),
      ...options,
      get [NavigationHistoryEntryKnownAs]() {
        return entry?.[NavigationHistoryEntryKnownAs];
      },
      get [EventTargetListeners]() {
        return entry?.[EventTargetListeners];
      },
    });
  };

  #createNavigationHistoryEntry = (
    options: Partial<NavigationHistoryEntryInit<S>> &
      Omit<NavigationHistoryEntryInit<S>, "index">
  ) => {
    const entry: NavigationHistoryEntry<S> = new NavigationHistoryEntry<S>({
      ...options,
      index:
        options.index ??
        (() => {
          return this.#entries.indexOf(entry);
        }),
    });
    return entry;
  };

  #pushEntry = (
    navigationType: InternalNavigationNavigationType,
    entry: NavigationHistoryEntry<S>,
    transition?: NavigationTransition<S>,
    options?: InternalNavigationNavigateOptions<S>
  ) => {
    /* c8 ignore start */
    if (entry === this.currentEntry) throw new InvalidStateError();
    const existingPosition = this.#entries.findIndex(
      (existing) => existing.id === entry.id
    );
    if (existingPosition > -1) {
      throw new InvalidStateError();
    }
    /* c8 ignore end */
    return this.#commitTransition(navigationType, entry, transition, options);
  };

  #commitTransition = (
    givenNavigationType: InternalNavigationNavigationType,
    entry: NavigationHistoryEntry<S>,
    transition?: NavigationTransition<S>,
    options?: InternalNavigationNavigateOptions<S>
  ) => {
    const nextTransition: NavigationTransition<S> =
      transition ??
      new NavigationTransition<S>({
        from: entry,
        navigationType:
          typeof givenNavigationType === "string"
            ? givenNavigationType
            : "replace",
        rollback: (options) => {
          return this.#rollback(nextTransition, options);
        },
        [NavigationTransitionNavigationType]: givenNavigationType,
        [NavigationTransitionInitialEntries]: [...this.#entries],
        [NavigationTransitionInitialIndex]: this.#currentIndex,
        [NavigationTransitionKnown]: [...this.#known],
        [NavigationTransitionEntry]: entry,
        [NavigationTransitionParentEventTarget]: this,
      });
    const { finished, committed } = nextTransition;
    const handler = () => {
      return this.#immediateTransition(
        givenNavigationType,
        entry,
        nextTransition,
        options
      );
    };
    this.#queueTransition(nextTransition);

    void handler().catch((error) => void error);

    // let nextPromise;
    // if (!this.#transitionInProgressCount || !this.#activePromise) {
    //   nextPromise = handler().catch((error) => void error);
    // } else {
    //   nextPromise = this.#activePromise.then(handler);
    // }
    //
    // const promise = nextPromise
    //     .catch(error => void error)
    //     .then(() => {
    //       if (this.#activePromise === promise) {
    //         this.#activePromise = undefined;
    //       }
    //     })
    //
    // this.#activePromise = promise;

    return { committed, finished };
  };

  #queueTransition = (transition: NavigationTransition<S>) => {
    // TODO consume errors that are not abort errors
    // transition.finished.catch(error => void error);
    this.#knownTransitions.add(transition);
  };

  #immediateTransition = (
    givenNavigationType: InternalNavigationNavigationType,
    entry: NavigationHistoryEntry<S>,
    transition: NavigationTransition<S>,
    options?: InternalNavigationNavigateOptions<S>
  ) => {
    try {
      // This number can grow if navigation is
      // called during a transition
      //
      // ... I had used transitionInProgressCount as a
      // safeguard until I could see this flow firsthand
      this.#transitionInProgressCount += 1;
      return this.#transition(givenNavigationType, entry, transition, options);
    } finally {
      this.#transitionInProgressCount -= 1;
    }
  };

  #rollback = (
    rollbackTransition: NavigationTransition<S>,
    options?: NavigationNavigationOptions
  ): NavigationResult => {
    const previousEntries =
      rollbackTransition[NavigationTransitionInitialEntries];
    const previousIndex = rollbackTransition[NavigationTransitionInitialIndex];
    const previousCurrent = previousEntries[previousIndex];
    // console.log("z");
    // console.log("Rollback!", { previousCurrent, previousEntries, previousIndex });
    const entry = previousCurrent
      ? this.#cloneNavigationHistoryEntry(previousCurrent, options)
      : undefined;
    const nextOptions: InternalNavigationNavigateOptions<S> = {
      ...options,
      index: previousIndex,
      known: new Set([...this.#known, ...previousEntries]),
      navigationType:
        entry?.[NavigationHistoryEntryNavigationType] ?? "replace",
      entries: previousEntries,
    } as const;
    const resolvedNavigationType = entry ? Rollback : Unset;
    const resolvedEntry =
      entry ??
      this.#createNavigationHistoryEntry({
        getState: this[NavigationGetState],
        navigationType: "replace",
        index: nextOptions.index,
        sameDocument: true,
        ...options,
      });
    return this.#pushEntry(
      resolvedNavigationType,
      resolvedEntry,
      undefined,
      nextOptions
    );
  };

  #transition = (
    givenNavigationType: InternalNavigationNavigationType,
    entry: NavigationHistoryEntry<S>,
    transition: NavigationTransition<S>,
    options?: InternalNavigationNavigateOptions<S>
  ): Promise<NavigationHistoryEntry<S>> => {
    // console.log({ givenNavigationType, transition });
    let navigationType = givenNavigationType;

    const performance = getPerformance();

    if (
      performance &&
      entry.sameDocument &&
      typeof navigationType === "string"
    ) {
      performance?.mark?.(`same-document-navigation:${entry.id}`);
    }

    let currentEntryChangeEvent = false,
        committedCurrentEntryChange = false;

    const { currentEntry } = this;
    void this.#activeTransition?.finished?.catch((error) => error);
    void this.#activeTransition?.[
      NavigationTransitionFinishedDeferred
    ]?.promise?.catch((error) => error);
    void this.#activeTransition?.[
      NavigationTransitionCommittedDeferred
    ]?.promise?.catch((error) => error);
    this.#activeTransition?.[NavigationTransitionAbort]();
    this.#activeTransition = transition;

    const startEventPromise = transition.dispatchEvent({
      type: NavigationTransitionStart,
      transition,
      entry,
    });

    const syncCommit = ({ entries, index, known }: NavigationTransitionCommitContext<S>) => {
      if (transition.signal.aborted) return;
      this.#entries = entries;
      if (known) {
        this.#known = new Set([...this.#known, ...known]);
      }
      this.#currentIndex = index;

      // Let's trigger external state here
      // because it is the absolute point of
      // committing to using an entry
      //
      // If the entry came from an external source
      // then internal to getState the external source will be pulled from
      // only if the entry doesn't hold the state in memory
      //
      // TLDR I believe this will be no issue doing here, even if we end up
      // calling an external setState multiple times, it is better than
      // loss of the state
      this[NavigationSetState](this.currentEntry);
    };

    const asyncCommit = async (commit: NavigationTransitionCommitContext<S>) => {
      if (committedCurrentEntryChange) {
        return;
      }
      committedCurrentEntryChange = true;
      syncCommit(commit);
      const { entriesChange } = commit;

      const promises = [
        transition.dispatchEvent(
            createEvent({
              type: NavigationTransitionCommit,
              transition,
              entry,
            })
        )
      ];

      if (entriesChange) {
        promises.push(
            this.dispatchEvent(
                createEvent<NavigationEntriesChangeEvent<S>>({
                  type: "entrieschange",
                  ...entriesChange
                })
            )
        )
      }

      await Promise.all(promises);
    }

    const unsetTransition = async () => {
      await startEventPromise;
      if (!(typeof options?.index === "number" && options.entries))
        throw new InvalidStateError();

      const previous = this.entries();
      const previousKeys = previous.map(entry => entry.key);
      const keys = options.entries.map(entry => entry.key);

      const removedEntries = previous.filter(entry => !keys.includes(entry.key));
      const addedEntries = options.entries.filter(entry => !previousKeys.includes(entry.key));

      await asyncCommit({
        entries: options.entries,
        index: options.index,
        known: options.known,
        entriesChange: (removedEntries.length || addedEntries.length) ? {
          removedEntries,
          addedEntries,
          updatedEntries: []
        } : undefined
      });

      await this.dispatchEvent(
        createEvent({
          type: "currententrychange",
        })
      );
      currentEntryChangeEvent = true;
      return entry;
    };

    const completeTransition = (): Promise<NavigationHistoryEntry<S>> => {
      if (givenNavigationType === Unset) {
        return unsetTransition();
      }

      const transitionResult = createNavigationTransition({
        currentEntry,
        currentIndex: this.#currentIndex,
        options,
        transition,
        known: this.#known,
        commit: asyncCommit,
        reportError: transition[NavigationTransitionRejected]
      });

      const microtask = new Promise<void>(queueMicrotask);
      let promises: Promise<PromiseSettledResult<unknown>>[] = [];
      const iterator = transitionSteps(transitionResult)[Symbol.iterator]();
      const iterable = {
        [Symbol.iterator]: () => ({ next: () => iterator.next() }),
      };

      async function syncTransition(): Promise<void> {
        for (const promise of iterable) {
          if (isPromise(promise)) {
            promises.push(Promise.allSettled([
                promise
            ]).then(([result]) => result));
          }
          if (
              transition[NavigationTransitionCommitIsManual] ||
              (currentEntryChangeEvent && transition[NavigationTransitionIsAsync])
          ) {
            return asyncTransition().then(syncTransition)
          }
          if (transition.signal.aborted) {
            break;
          }
        }
        if (promises.length) {
          return asyncTransition();
        }
      }

      async function asyncTransition(): Promise<void> {
        const captured = [...promises];
        if (captured.length) {
          promises = [];
          const results = await Promise.all(captured);
          const rejected = results.filter(isPromiseRejectedResult);
          if (rejected.length === 1) {
            throw await Promise.reject(rejected[0]);
          } else if (rejected.length) {
            throw new AggregateError(rejected, rejected[0].reason?.message);
          }
        } else if (!transition[NavigationTransitionIsOngoing]) {
          await microtask;
        }
      }

      // console.log("Returning", { entry });
      return syncTransition()
        .then(() =>
          transition[NavigationTransitionIsOngoing] ? undefined : microtask
        )
        .then(() => entry);
    };

    const dispose = async () => this.#dispose();

    function* transitionSteps(
      transitionResult: NavigationTransitionResult<S>
    ): Iterable<Promise<unknown> | unknown | void> {
      const microtask = new Promise<void>(queueMicrotask);
      const { currentEntryChange, navigate, waitForCommit, commit, abortController } =
        transitionResult;

      const navigateAbort = abortController.abort.bind(abortController);
      transition.signal.addEventListener("abort", navigateAbort, {
        once: true,
      });

      if (typeof navigationType === "string" || navigationType === Rollback) {
        const promise = currentEntry?.dispatchEvent(
          createEvent({
            type: "navigatefrom",
            intercept: transition[NavigationIntercept],
            /**
             * @deprecated
             */
            transitionWhile: transition[NavigationIntercept],
          })
        );
        if (promise) yield promise;
      }

      if (typeof navigationType === "string") {
        yield transition.dispatchEvent(navigate);
      }

      if (!transition[NavigationTransitionCommitIsManual]) {
        commit()
      }

      yield waitForCommit;

      if (entry.sameDocument) {
        yield transition.dispatchEvent(currentEntryChange);
      }
      currentEntryChangeEvent = true;
      if (typeof navigationType === "string") {
        yield entry.dispatchEvent(
          createEvent({
            type: "navigateto",
            intercept: transition[NavigationIntercept],
            /**
             * @deprecated
             */
            transitionWhile: transition[NavigationIntercept],
          })
        );
      }
      yield dispose();
      if (!transition[NavigationTransitionPromises].size) {
        yield microtask;
      }
      yield transition.dispatchEvent({
        type: NavigationTransitionStartDeadline,
        transition,
        entry,
      });
      yield transition[NavigationTransitionWait]();
      transition.signal.removeEventListener("abort", navigateAbort);
      yield transition[NavigationTransitionFinish]();
      if (typeof navigationType === "string") {
        yield transition.dispatchEvent(
          createEvent({
            type: "finish",
            intercept: transition[NavigationIntercept],
            /**
             * @deprecated
             */
            transitionWhile: transition[NavigationIntercept],
          })
        );
        yield transition.dispatchEvent(
          createEvent({
            type: "navigatesuccess",
            intercept: transition[NavigationIntercept],
            /**
             * @deprecated
             */
            transitionWhile: transition[NavigationIntercept],
          })
        );
      }
    }

    const maybeSyncTransition = () => {
      try {
        return completeTransition();
      } catch (error) {
        return Promise.reject(error);
      }
    };

    return Promise.allSettled([maybeSyncTransition()])
      .then(async ([detail]) => {
        if (detail.status === "rejected") {
          await transition.dispatchEvent({
            type: NavigationTransitionError,
            error: detail.reason,
            transition,
            entry,
          });
        }

        await dispose();
        await transition.dispatchEvent({
          type: NavigationTransitionFinally,
          transition,
          entry,
        });
        await transition[NavigationTransitionWait]();
        if (this.#activeTransition === transition) {
          this.#activeTransition = undefined;
        }
        if (entry.sameDocument && typeof navigationType === "string") {
          performance.mark(`same-document-navigation-finish:${entry.id}`);
          performance.measure(
            `same-document-navigation:${entry.url}`,
            `same-document-navigation:${entry.id}`,
            `same-document-navigation-finish:${entry.id}`
          );
        }
      })
      .then(() => entry);
  };

  #dispose = async () => {
    // console.log(JSON.stringify({ known: [...this.#known], entries: this.#entries }));

    for (const known of this.#known) {
      const index = this.#entries.findIndex((entry) => entry.key === known.key);
      if (index !== -1) {
        // Still in use
        continue;
      }
      // No index, no longer known
      this.#known.delete(known);
      const event = createEvent({
        type: "dispose",
        entry: known,
      });
      this[NavigationDisposeState](known);
      await known.dispatchEvent(event);
      await this.dispatchEvent(event);
    }
    // console.log(JSON.stringify({ pruned: [...this.#known] }));
  };

  reload(
    options?: NavigationReloadOptions<S>
  ): NavigationResult<S> {
    const { currentEntry } = this;
    if (!currentEntry) throw new InvalidStateError();
    const entry = this.#cloneNavigationHistoryEntry(currentEntry, options);
    return this.#pushEntry("reload", entry, undefined, options);
  }

  updateCurrentEntry(options: NavigationUpdateCurrentOptions<S>): unknown;
  updateCurrentEntry(options: NavigationUpdateCurrentOptions<S>): void;
  updateCurrentEntry(options: NavigationUpdateCurrentOptions<S>): unknown {
    const { currentEntry } = this;

    if (!currentEntry) {
      throw new InvalidStateError("Expected current entry");
    }

    // Instant change
    currentEntry[NavigationHistoryEntrySetState](options.state);
    this[NavigationSetState](currentEntry);

    const currentEntryChange = new NavigationCurrentEntryChangeEvent("currententrychange", {
      from: currentEntry,
      navigationType: undefined,
    });
    const entriesChange: NavigationEntriesChangeEvent = createEvent({
      type: "entrieschange",
      addedEntries: [],
      removedEntries: [],
      updatedEntries: [
          currentEntry
      ]
    });

    return Promise.all([
      this.dispatchEvent(currentEntryChange),
      this.dispatchEvent(entriesChange)
    ]) ;
  }
}

function getPerformance(): {
  now(): number;
  measure(name: string, start: string, finish: string): unknown;
  mark(mark: string): unknown;
} {
  if (typeof performance !== "undefined") {
    return performance;
  }
  /* c8 ignore start */
  return {
    now() {
      return Date.now();
    },
    mark() {},
    measure() {},
  };
  // const { performance: nodePerformance } = await import("perf_hooks");
  // return nodePerformance;
  /* c8 ignore end */
}
