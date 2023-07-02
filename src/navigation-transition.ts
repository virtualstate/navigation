import {
  NavigationHistoryEntry as NavigationHistoryEntryPrototype,
  NavigationIntercept as NavigationInterceptPrototype, NavigationInterceptOptions,
  NavigationNavigationOptions,
  NavigationNavigationType,
  NavigationResult,
  NavigationTransition as NavigationTransitionPrototype,
  NavigationTransitionInit as NavigationTransitionInitPrototype,
} from "./spec/navigation";
import { NavigationHistoryEntry } from "./navigation-entry";
import { deferred, Deferred } from "./util/deferred";
import {
  AbortError,
  InvalidStateError,
  isAbortError,
  isInvalidStateError,
} from "./navigation-errors";
import { Event, EventTarget } from "./event-target";
import { AbortController } from "./import-abort-controller";
import {isPromise} from "./is";

export const Rollback = Symbol.for("@virtualstate/navigation/rollback");
export const Unset = Symbol.for("@virtualstate/navigation/unset");

export type InternalNavigationNavigationType =
  | NavigationNavigationType
  | typeof Rollback
  | typeof Unset;

export const NavigationTransitionParentEventTarget = Symbol.for(
  "@virtualstate/navigation/transition/parentEventTarget"
);

export const NavigationTransitionFinishedDeferred = Symbol.for(
  "@virtualstate/navigation/transition/deferred/finished"
);
export const NavigationTransitionCommittedDeferred = Symbol.for(
  "@virtualstate/navigation/transition/deferred/committed"
);
export const NavigationTransitionNavigationType = Symbol.for(
  "@virtualstate/navigation/transition/navigationType"
);
export const NavigationTransitionInitialEntries = Symbol.for(
  "@virtualstate/navigation/transition/entries/initial"
);
export const NavigationTransitionFinishedEntries = Symbol.for(
  "@virtualstate/navigation/transition/entries/finished"
);
export const NavigationTransitionInitialIndex = Symbol.for(
  "@virtualstate/navigation/transition/index/initial"
);
export const NavigationTransitionFinishedIndex = Symbol.for(
  "@virtualstate/navigation/transition/index/finished"
);
export const NavigationTransitionEntry = Symbol.for(
  "@virtualstate/navigation/transition/entry"
);

export const NavigationTransitionIsCommitted = Symbol.for(
  "@virtualstate/navigation/transition/isCommitted"
);
export const NavigationTransitionIsFinished = Symbol.for(
  "@virtualstate/navigation/transition/isFinished"
);
export const NavigationTransitionIsRejected = Symbol.for(
  "@virtualstate/navigation/transition/isRejected"
);

export const NavigationTransitionKnown = Symbol.for(
  "@virtualstate/navigation/transition/known"
);
export const NavigationTransitionPromises = Symbol.for(
  "@virtualstate/navigation/transition/promises"
);

export const NavigationIntercept = Symbol.for(
    "@virtualstate/navigation/intercept"
);
export const NavigationTransitionIsOngoing = Symbol.for(
  "@virtualstate/navigation/transition/isOngoing"
);
export const NavigationTransitionIsPending = Symbol.for(
  "@virtualstate/navigation/transition/isPending"
);
export const NavigationTransitionIsAsync = Symbol.for(
    "@virtualstate/navigation/transition/isAsync"
);
export const NavigationTransitionWait = Symbol.for(
  "@virtualstate/navigation/transition/wait"
);

export const NavigationTransitionPromiseResolved = Symbol.for(
  "@virtualstate/navigation/transition/promise/resolved"
);

export const NavigationTransitionRejected = Symbol.for(
  "@virtualstate/navigation/transition/rejected"
);

export const NavigationTransitionCommit = Symbol.for(
  "@virtualstate/navigation/transition/commit"
);
export const NavigationTransitionFinish = Symbol.for(
  "@virtualstate/navigation/transition/finish"
);
export const NavigationTransitionStart = Symbol.for(
  "@virtualstate/navigation/transition/start"
);
export const NavigationTransitionStartDeadline = Symbol.for(
  "@virtualstate/navigation/transition/start/deadline"
);
export const NavigationTransitionError = Symbol.for(
  "@virtualstate/navigation/transition/error"
);
export const NavigationTransitionFinally = Symbol.for(
  "@virtualstate/navigation/transition/finally"
);
export const NavigationTransitionAbort = Symbol.for(
    "@virtualstate/navigation/transition/abort"
);
export const NavigationTransitionInterceptOptionsCommit = Symbol.for(
    "@virtualstate/navigation/transition/intercept/options/commit"
);
export const NavigationTransitionCommitIsManual = Symbol.for(
    "@virtualstate/navigation/transition/commit/isManual"
);

export interface NavigationTransitionInit<S = unknown, R = unknown | void>
  extends Omit<NavigationTransitionInitPrototype, "finished"> {
  rollback(options?: NavigationNavigationOptions): NavigationResult<S>;
  [NavigationTransitionFinishedDeferred]?: Deferred<NavigationHistoryEntry<S>>;
  [NavigationTransitionCommittedDeferred]?: Deferred<NavigationHistoryEntry<S>>;
  [NavigationTransitionNavigationType]: InternalNavigationNavigationType;
  [NavigationTransitionInitialEntries]: NavigationHistoryEntry<S>[];
  [NavigationTransitionInitialIndex]: number;
  [NavigationTransitionFinishedEntries]?: NavigationHistoryEntry<S>[];
  [NavigationTransitionFinishedIndex]?: number;
  [NavigationTransitionKnown]?: Iterable<EventTarget>;
  [NavigationTransitionEntry]: NavigationHistoryEntry<S>;
  [NavigationTransitionParentEventTarget]: EventTarget;
}

export class NavigationTransition<S = unknown, R = unknown | void>
  extends EventTarget
  implements NavigationTransitionPrototype<S>
{
  readonly finished: Promise<NavigationHistoryEntryPrototype<S>>;
  /**
   * @experimental
   */
  readonly committed: Promise<NavigationHistoryEntryPrototype<S>>;
  readonly from: NavigationHistoryEntryPrototype<S>;
  readonly navigationType: NavigationNavigationType;

  /**
   * true if transition has an async intercept
   */
  [NavigationTransitionIsAsync] = false;

  /**
   * @experimental
   */
  readonly [NavigationTransitionInterceptOptionsCommit]: NavigationInterceptOptions<S>["commit"][]

  readonly #options: NavigationTransitionInit<S, R>;

  readonly [NavigationTransitionFinishedDeferred] =
    deferred<NavigationHistoryEntry<S>>();
  readonly [NavigationTransitionCommittedDeferred] =
    deferred<NavigationHistoryEntry<S>>();

  get [NavigationTransitionIsPending]() {
    return !!this.#promises.size;
  }

  get [NavigationTransitionNavigationType](): InternalNavigationNavigationType {
    return this.#options[NavigationTransitionNavigationType];
  }

  get [NavigationTransitionInitialEntries](): NavigationHistoryEntry<S>[] {
    return this.#options[NavigationTransitionInitialEntries];
  }

  get [NavigationTransitionInitialIndex](): number {
    return this.#options[NavigationTransitionInitialIndex];
  }

  get [NavigationTransitionCommitIsManual](): boolean {
    return !!(
        this[NavigationTransitionInterceptOptionsCommit]?.includes("after-transition") ||
        this[NavigationTransitionInterceptOptionsCommit]?.includes("manual")
    )
  }

  [NavigationTransitionFinishedEntries]?: NavigationHistoryEntry<S>[];
  [NavigationTransitionFinishedIndex]?: number;
  [NavigationTransitionIsCommitted] = false;
  [NavigationTransitionIsFinished] = false;
  [NavigationTransitionIsRejected] = false;
  [NavigationTransitionIsOngoing] = false;

  readonly [NavigationTransitionKnown] = new Set<EventTarget>();
  readonly [NavigationTransitionEntry]: NavigationHistoryEntry<S>;

  #promises = new Set<Promise<PromiseSettledResult<void>>>();

  #rolledBack = false;

  #abortController = new AbortController();

  get signal() {
    return this.#abortController.signal;
  }

  get [NavigationTransitionPromises]() {
    return this.#promises;
  }

  constructor(init: NavigationTransitionInit<S, R>) {
    super();

    this[NavigationTransitionInterceptOptionsCommit] = [];

    this[NavigationTransitionFinishedDeferred] =
      init[NavigationTransitionFinishedDeferred] ??
      this[NavigationTransitionFinishedDeferred];
    this[NavigationTransitionCommittedDeferred] =
      init[NavigationTransitionCommittedDeferred] ??
      this[NavigationTransitionCommittedDeferred];

    this.#options = init;
    const finished = (this.finished =
      this[NavigationTransitionFinishedDeferred].promise);
    const committed = (this.committed =
      this[NavigationTransitionCommittedDeferred].promise);
    // Auto catching abort
    void finished.catch((error) => error);
    void committed.catch((error) => error);
    this.from = init.from;
    this.navigationType = init.navigationType;
    this[NavigationTransitionFinishedEntries] =
      init[NavigationTransitionFinishedEntries];
    this[NavigationTransitionFinishedIndex] =
      init[NavigationTransitionFinishedIndex];
    const known = init[NavigationTransitionKnown];
    if (known) {
      for (const entry of known) {
        this[NavigationTransitionKnown].add(entry);
      }
    }
    this[NavigationTransitionEntry] = init[NavigationTransitionEntry];

    // Event listeners
    {
      // Events to promises
      {
        this.addEventListener(
          NavigationTransitionCommit,
          this.#onCommitPromise,
          { once: true }
        );
        this.addEventListener(
          NavigationTransitionFinish,
          this.#onFinishPromise,
          { once: true }
        );
      }

      // Events to property setters
      {
        this.addEventListener(
          NavigationTransitionCommit,
          this.#onCommitSetProperty,
          { once: true }
        );
        this.addEventListener(
          NavigationTransitionFinish,
          this.#onFinishSetProperty,
          { once: true }
        );
      }

      // Rejection + Abort
      {
        this.addEventListener(NavigationTransitionError, this.#onError, {
          once: true,
        });
        this.addEventListener(NavigationTransitionAbort, () => {
          if (!this[NavigationTransitionIsFinished]) {
            return this[NavigationTransitionRejected](new AbortError());
          }
        });
      }

      // Proxy all events from this transition onto entry + the parent event target
      //
      // The parent could be another transition, or the Navigation, this allows us to
      // "bubble up" events layer by layer
      //
      // In this implementation, this allows individual transitions to "intercept" navigate and break the child
      // transition from happening
      //
      // TODO WARN this may not be desired behaviour vs standard spec'd Navigation
      {
        this.addEventListener(
          "*",
          this[NavigationTransitionEntry].dispatchEvent.bind(
            this[NavigationTransitionEntry]
          )
        );
        this.addEventListener(
          "*",
          init[NavigationTransitionParentEventTarget].dispatchEvent.bind(
            init[NavigationTransitionParentEventTarget]
          )
        );
      }
    }
  }

  rollback = (options?: NavigationNavigationOptions): NavigationResult => {
    // console.log({ rolled: this.#rolledBack });
    if (this.#rolledBack) {
      // TODO
      throw new InvalidStateError(
        "Rollback invoked multiple times: Please raise an issue at https://github.com/virtualstate/navigation with the use case where you want to use a rollback multiple times, this may have been unexpected behaviour"
      );
    }
    this.#rolledBack = true;
    return this.#options.rollback(options);
  };

  #onCommitSetProperty = () => {
    this[NavigationTransitionIsCommitted] = true;
  };

  #onFinishSetProperty = () => {
    this[NavigationTransitionIsFinished] = true;
  };

  #onFinishPromise = () => {
    // console.log("onFinishPromise")
    this[NavigationTransitionFinishedDeferred].resolve(
      this[NavigationTransitionEntry]
    );
  };

  #onCommitPromise = () => {
    if (this.signal.aborted) {
    } else {
      this[NavigationTransitionCommittedDeferred].resolve(
        this[NavigationTransitionEntry]
      );
    }
  };

  #onError = (event: Event & { error: unknown }) => {
    return this[NavigationTransitionRejected](event.error);
  };

  [NavigationTransitionPromiseResolved] = (
    ...promises: Promise<PromiseSettledResult<void>>[]
  ) => {
    for (const promise of promises) {
      this.#promises.delete(promise);
    }
  };

  [NavigationTransitionRejected] = async (reason: unknown) => {
    if (this[NavigationTransitionIsRejected]) return;
    this[NavigationTransitionIsRejected] = true;
    this[NavigationTransitionAbort]();

    const navigationType = this[NavigationTransitionNavigationType];

    // console.log({ navigationType, reason, entry: this[NavigationTransitionEntry] });

    if (typeof navigationType === "string" || navigationType === Rollback) {
      // console.log("navigateerror", { reason, z: isInvalidStateError(reason) });
      await this.dispatchEvent({
        type: "navigateerror",
        error: reason,
        get message() {
          if (reason instanceof Error) {
            return reason.message;
          }
          return `${reason}`;
        },
      });
      // console.log("navigateerror finished");

      if (
        navigationType !== Rollback &&
        !(isInvalidStateError(reason) || isAbortError(reason))
      ) {
        try {
          // console.log("Rollback", navigationType);
          // console.warn("Rolling back immediately due to internal error", error);
          await this.rollback()?.finished;
          // console.log("Rollback complete", navigationType);
        } catch (error) {
          // console.error("Failed to rollback", error);
          throw new InvalidStateError(
            "Failed to rollback, please raise an issue at https://github.com/virtualstate/navigation/issues"
          );
        }
      }
    }
    this[NavigationTransitionCommittedDeferred].reject(reason);
    this[NavigationTransitionFinishedDeferred].reject(reason);
  };

  [NavigationIntercept] = (options: NavigationInterceptPrototype<R>): void => {
    const transition = this;
    const promise = parseOptions();
    this[NavigationTransitionIsOngoing] = true;
    if (!promise) return;
    this[NavigationTransitionIsAsync] = true;
    const statusPromise = promise
        .then(
            (): PromiseSettledResult<void> => ({
              status: "fulfilled",
              value: undefined,
            })
        )
        .catch(async (reason): Promise<PromiseSettledResult<void>> => {
          await this[NavigationTransitionRejected](reason);
          return {
            status: "rejected",
            reason,
          };
        });
    this.#promises.add(statusPromise);

    function parseOptions(): Promise<R> | undefined {
      if (!options) return undefined
      if (isPromise<R>(options)) {
        return options;
      }
      if (typeof options === "function") {
        return options();
      }
      const { handler, commit } = options;
      if (commit && typeof commit === "string") {
        transition[NavigationTransitionInterceptOptionsCommit].push(commit);
      }
      if (typeof handler !== "function") {
        return;
      }
      return handler();
    }

  };

  [NavigationTransitionWait] = async (): Promise<NavigationHistoryEntry<S>> => {
    if (!this.#promises.size) return this[NavigationTransitionEntry];
    try {
      const captured = [...this.#promises];
      const results = await Promise.all(captured);
      const rejected = results.filter<PromiseRejectedResult>(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected"
      );
      // console.log({ rejected, results, captured });
      if (rejected.length) {
        // TODO handle differently when there are failures, e.g. we could move navigateerror to here
        if (rejected.length === 1) {
          throw rejected[0].reason;
        }
        if (typeof AggregateError !== "undefined") {
          throw new AggregateError(rejected.map(({ reason }) => reason));
        }
        throw new Error();
      }
      this[NavigationTransitionPromiseResolved](...captured);

      if (this[NavigationTransitionIsPending]) {
        return this[NavigationTransitionWait]();
      }

      return this[NavigationTransitionEntry];
    } catch (error) {
      await this.#onError(error);
      throw await Promise.reject(error);
    } finally {
      await this[NavigationTransitionFinish]();
    }
  };

  [NavigationTransitionAbort]() {
    if (this.#abortController.signal.aborted) return;
    this.#abortController.abort();
    this.dispatchEvent({
      type: NavigationTransitionAbort,
      transition: this,
      entry: this[NavigationTransitionEntry],
    });
  }

  [NavigationTransitionFinish] = async () => {
    if (this[NavigationTransitionIsFinished]) {
      return;
    }

    await this.dispatchEvent({
      type: NavigationTransitionFinish,
      transition: this,
      entry: this[NavigationTransitionEntry],
      intercept: this[NavigationIntercept],
    });
  };
}
