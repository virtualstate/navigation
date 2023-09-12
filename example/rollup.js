function isEvent(value) {
    function isLike(value) {
        return !!value;
    }
    return (isLike(value) &&
        (typeof value.type === "string" || typeof value.type === "symbol"));
}
function assertEvent(value, type) {
    if (!isEvent(value)) {
        throw new Error("Expected event");
    }
    if (typeof type !== "undefined" && value.type !== type) {
        throw new Error(`Expected event type ${String(type)}, got ${value.type.toString()}`);
    }
}

function isParallelEvent(value) {
    return isEvent(value) && value.parallel !== false;
}

class AbortError extends Error {
    constructor(message) {
        super(`AbortError${message ? `: ${message}` : ""}`);
        this.name = "AbortError";
    }
}
function isAbortError(error) {
    return error instanceof Error && error.name === "AbortError";
}
class InvalidStateError extends Error {
    constructor(message) {
        super(`InvalidStateError${message ? `: ${message}` : ""}`);
        this.name = "InvalidStateError";
    }
}
function isInvalidStateError(error) {
    return error instanceof Error && error.name === "InvalidStateError";
}

function isAbortSignal(value) {
    function isAbortSignalLike(value) {
        return typeof value === "object";
    }
    return (isAbortSignalLike(value) &&
        typeof value.aborted === "boolean" &&
        typeof value.addEventListener === "function");
}
function isSignalEvent(value) {
    function isSignalEventLike(value) {
        return value.hasOwnProperty("signal");
    }
    return (isEvent(value) && isSignalEventLike(value) && isAbortSignal(value.signal));
}
function isSignalHandled(event, error) {
    if (isSignalEvent(event) &&
        event.signal.aborted &&
        error instanceof Error &&
        isAbortError(error)) {
        return true;
    }
}

/**
 * @experimental
 */
const EventTargetListeners$1 = Symbol.for("@opennetwork/environment/events/target/listeners");
/**
 * @experimental
 */
const EventTargetListenersIgnore = Symbol.for("@opennetwork/environment/events/target/listeners/ignore");
/**
 * @experimental
 */
const EventTargetListenersMatch = Symbol.for("@opennetwork/environment/events/target/listeners/match");
/**
 * @experimental
 */
const EventTargetListenersThis = Symbol.for("@opennetwork/environment/events/target/listeners/this");

const EventDescriptorSymbol = Symbol.for("@opennetwork/environment/events/descriptor");

function matchEventCallback(type, callback, options) {
    const optionsDescriptor = isOptionsDescriptor(options) ? options : undefined;
    return (descriptor) => {
        if (optionsDescriptor) {
            return optionsDescriptor === descriptor;
        }
        return ((!callback || callback === descriptor.callback) &&
            type === descriptor.type);
    };
    function isOptionsDescriptor(options) {
        function isLike(options) {
            return !!options;
        }
        return isLike(options) && options[EventDescriptorSymbol] === true;
    }
}

function isFunctionEventCallback(fn) {
    return typeof fn === "function";
}
const EventTargetDescriptors = Symbol.for("@virtualstate/navigation/event-target/descriptors");
class EventTargetListeners {
    [EventTargetDescriptors] = [];
    [EventTargetListenersIgnore] = new WeakSet();
    get [EventTargetListeners$1]() {
        return [...(this[EventTargetDescriptors] ?? [])];
    }
    [EventTargetListenersMatch](type) {
        const external = this[EventTargetListeners$1];
        const matched = [
            ...new Set([...(external ?? []), ...(this[EventTargetDescriptors] ?? [])]),
        ]
            .filter((descriptor) => descriptor.type === type || descriptor.type === "*")
            .filter((descriptor) => !this[EventTargetListenersIgnore]?.has(descriptor));
        const listener = typeof type === "string" ? this[`on${type}`] : undefined;
        if (typeof listener === "function" && isFunctionEventCallback(listener)) {
            matched.push({
                type,
                callback: listener,
                [EventDescriptorSymbol]: true,
            });
        }
        return matched;
    }
    addEventListener(type, callback, options) {
        const listener = {
            ...options,
            isListening: () => !!this[EventTargetDescriptors]?.find(matchEventCallback(type, callback)),
            descriptor: {
                [EventDescriptorSymbol]: true,
                ...options,
                type,
                callback,
            },
            timestamp: Date.now(),
        };
        if (listener.isListening()) {
            return;
        }
        this[EventTargetDescriptors]?.push(listener.descriptor);
    }
    removeEventListener(type, callback, options) {
        if (!isFunctionEventCallback(callback)) {
            return;
        }
        const externalListeners = this[EventTargetListeners$1] ?? this[EventTargetDescriptors] ?? [];
        const externalIndex = externalListeners.findIndex(matchEventCallback(type, callback, options));
        if (externalIndex === -1) {
            return;
        }
        const index = this[EventTargetDescriptors]?.findIndex(matchEventCallback(type, callback, options)) ??
            -1;
        if (index !== -1) {
            this[EventTargetDescriptors]?.splice(index, 1);
        }
        const descriptor = externalListeners[externalIndex];
        if (descriptor) {
            this[EventTargetListenersIgnore]?.add(descriptor);
        }
    }
    hasEventListener(type, callback) {
        if (callback && !isFunctionEventCallback(callback)) {
            return false;
        }
        const foundIndex = this[EventTargetDescriptors]?.findIndex(matchEventCallback(type, callback)) ?? -1;
        return foundIndex > -1;
    }
}

class AsyncEventTarget extends EventTargetListeners {
    [EventTargetListenersThis];
    constructor(thisValue = undefined) {
        super();
        this[EventTargetListenersThis] = thisValue;
    }
    async dispatchEvent(event) {
        const listeners = this[EventTargetListenersMatch]?.(event.type) ?? [];
        // Don't even dispatch an aborted event
        if (isSignalEvent(event) && event.signal.aborted) {
            throw new AbortError();
        }
        const parallel = isParallelEvent(event);
        const promises = [];
        for (let index = 0; index < listeners.length; index += 1) {
            const descriptor = listeners[index];
            const promise = (async () => {
                // Remove the listener before invoking the callback
                // This ensures that inside of the callback causes no more additional event triggers to this
                // listener
                if (descriptor.once) {
                    // by passing the descriptor as the options, we get an internal redirect
                    // that forces an instance level object equals, meaning
                    // we will only remove _this_ descriptor!
                    this.removeEventListener(descriptor.type, descriptor.callback, descriptor);
                }
                await descriptor.callback.call(this[EventTargetListenersThis] ?? this, event);
            })();
            if (!parallel) {
                try {
                    await promise;
                }
                catch (error) {
                    if (!isSignalHandled(event, error)) {
                        await Promise.reject(error);
                    }
                }
                if (isSignalEvent(event) && event.signal.aborted) {
                    // bye
                    return;
                }
            }
            else {
                promises.push(promise);
            }
        }
        if (promises.length) {
            // Allows for all promises to settle finish so we can stay within the event, we then
            // will utilise Promise.all which will reject with the first rejected promise
            const results = await Promise.allSettled(promises);
            const rejected = results.filter((result) => {
                return result.status === "rejected";
            });
            if (rejected.length) {
                let unhandled = rejected;
                // If the event was aborted, then allow abort errors to occur, and handle these as handled errors
                // The dispatcher does not care about this because they requested it
                //
                // There may be other unhandled errors that are more pressing to the task they are doing.
                //
                // The dispatcher can throw an abort error if they need to throw it up the chain
                if (isSignalEvent(event) && event.signal.aborted) {
                    unhandled = unhandled.filter((result) => !isSignalHandled(event, result.reason));
                }
                if (unhandled.length === 1) {
                    await Promise.reject(unhandled[0].reason);
                    throw unhandled[0].reason; // We shouldn't get here
                }
                else if (unhandled.length > 1) {
                    throw new AggregateError(unhandled.map(({ reason }) => reason));
                }
            }
        }
    }
}

const defaultEventTargetModule = {
    EventTarget: AsyncEventTarget,
    AsyncEventTarget,
    SyncEventTarget: AsyncEventTarget,
};
let eventTargetModule = defaultEventTargetModule;
//
// try {
//     eventTargetModule = await import("@virtualstate/navigation/event-target");
//     console.log("Using @virtualstate/navigation/event-target", eventTargetModule);
// } catch {
//     console.log("Using defaultEventTargetModule");
//     eventTargetModule = defaultEventTargetModule;
// }
const EventTargetImplementation = eventTargetModule.EventTarget || eventTargetModule.SyncEventTarget || eventTargetModule.AsyncEventTarget;
function assertEventTarget(target) {
    if (typeof target !== "function") {
        throw new Error("Could not load EventTarget implementation");
    }
}
class EventTarget extends AsyncEventTarget {
    constructor(...args) {
        super();
        if (EventTargetImplementation) {
            assertEventTarget(EventTargetImplementation);
            const { dispatchEvent } = new EventTargetImplementation(...args);
            this.dispatchEvent = dispatchEvent;
        }
    }
}

function isInterceptEvent(value) {
    function isInterceptEventLike(value) {
        return isEvent(value);
    }
    return (isInterceptEventLike(value) && typeof value.intercept === "function");
}

class NavigationEventTarget extends EventTarget {
    addEventListener(type, listener, options) {
        assertEventCallback(listener);
        return super.addEventListener(type, listener, typeof options === "boolean" ? { once: options } : options);
        function assertEventCallback(listener) {
            if (typeof listener !== "function")
                throw new Error("Please us the function variant of event listener");
        }
    }
    removeEventListener(type, listener, options) {
        assertEventCallback(listener);
        return super.removeEventListener(type, listener);
        function assertEventCallback(listener) {
            if (typeof listener !== "function")
                throw new Error("Please us the function variant of event listener");
        }
    }
}

const fakeUUID = {
    v4() {
        return Array
            .from({ length: 5 }, () => `${Math.random()}`.replace(/^0\./, ""))
            .join("-")
            .replace(".", "");
    },
};
async function getImportUUIDOrNodeRandomUUID() {
    const { v4 } = await Promise.resolve().then(function () { return importUuid; })
        .catch(async () => {
        // @ts-ignore
        const crypto = await import('node:crypto');
        return {
            v4() {
                return crypto.randomUUID();
            }
        };
    })
        .catch(async () => Promise.resolve().then(function () { return index; }))
        .catch(() => undefined)
        .then((mod) => mod ?? fakeUUID);
    return { v4 };
}
/** post rollup replace importUuid **/
const uuidModule = (await getImportUUIDOrNodeRandomUUID());
const getUuidModule = () => uuidModule;
/** post rollup replace importUuid **/
function v4$2() {
    const uuidModule = getUuidModule();
    if (!(uuidModule?.v4))
        return fakeUUID.v4();
    return uuidModule.v4();
}

// To prevent cyclic imports, where a circular is used, instead use the prototype interface
// and then copy over the "private" symbol
const NavigationGetState$1 = Symbol.for("@virtualstate/navigation/getState");
const NavigationHistoryEntryNavigationType = Symbol.for("@virtualstate/navigation/entry/navigationType");
const NavigationHistoryEntryKnownAs = Symbol.for("@virtualstate/navigation/entry/knownAs");
const NavigationHistoryEntrySetState = Symbol.for("@virtualstate/navigation/entry/setState");
function isPrimitiveValue(state) {
    return (typeof state === "number" ||
        typeof state === "boolean" ||
        typeof state === "symbol" ||
        typeof state === "bigint" ||
        typeof state === "string");
}
function isValue(state) {
    return !!(state || isPrimitiveValue(state));
}
class NavigationHistoryEntry extends NavigationEventTarget {
    #index;
    #state;
    get index() {
        return typeof this.#index === "number" ? this.#index : this.#index();
    }
    key;
    id;
    url;
    sameDocument;
    get [NavigationHistoryEntryNavigationType]() {
        return this.#options.navigationType;
    }
    get [NavigationHistoryEntryKnownAs]() {
        const set = new Set(this.#options[NavigationHistoryEntryKnownAs]);
        set.add(this.id);
        return set;
    }
    #options;
    get [EventTargetListeners$1]() {
        return [
            ...(super[EventTargetListeners$1] ?? []),
            ...(this.#options[EventTargetListeners$1] ?? []),
        ];
    }
    constructor(init) {
        super();
        this.#options = init;
        this.key = init.key || v4$2();
        this.id = v4$2();
        this.url = init.url ?? undefined;
        this.#index = init.index;
        this.sameDocument = init.sameDocument ?? true;
        this.#state = init.state ?? undefined;
    }
    [NavigationGetState$1]() {
        return this.#options?.getState?.(this);
    }
    getState() {
        let state = this.#state;
        if (!isValue(state)) {
            const external = this[NavigationGetState$1]();
            if (isValue(external)) {
                state = this.#state = external;
            }
        }
        /**
         * https://github.com/WICG/app-history/blob/7c0332b30746b14863f717404402bc49e497a2b2/spec.bs#L1406
         * Note that in general, unless the state value is a primitive, entry.getState() !== entry.getState(), since a fresh copy is returned each time.
         */
        if (typeof state === "undefined" ||
            isPrimitiveValue(state)) {
            return state;
        }
        if (typeof state === "function") {
            console.warn("State passed to Navigation.navigate was a function, this may be unintentional");
            console.warn("Unless a state value is primitive, with a standard implementation of Navigation");
            console.warn("your state value will be serialized and deserialized before this point, meaning");
            console.warn("a function would not be usable.");
        }
        return {
            ...state,
        };
    }
    [NavigationHistoryEntrySetState](state) {
        this.#state = state;
    }
}

/**
 * @param handleCatch rejected promises automatically to allow free usage
 */
function deferred(handleCatch) {
    let resolve = undefined, reject = undefined;
    const promise = new Promise((resolveFn, rejectFn) => {
        resolve = resolveFn;
        reject = rejectFn;
    });
    ok$1(resolve);
    ok$1(reject);
    return {
        resolve,
        reject,
        promise: handleCatch ? promise.catch(handleCatch) : promise,
    };
}
function ok$1(value) {
    if (!value) {
        throw new Error("Value not provided");
    }
}

const GlobalAbortController = typeof AbortController !== "undefined" ? AbortController : undefined;

// import ImportedAbortController from "abort-controller";
// async function importAbortController() {
//     const { default: AbortController } = await import("abort-controller");
//     return AbortController;
// }
if (!GlobalAbortController) {
    throw new Error("AbortController expected to be available or polyfilled");
}
const AbortController$1 = GlobalAbortController; // await importAbortController();

function isPromise(value) {
    return (like(value) &&
        typeof value.then === "function");
}
function ok(value, message = "Expected value") {
    if (!value) {
        throw new Error(message);
    }
}
function isPromiseRejectedResult(value) {
    return value.status === "rejected";
}
function like(value) {
    return !!value;
}

const Rollback = Symbol.for("@virtualstate/navigation/rollback");
const Unset = Symbol.for("@virtualstate/navigation/unset");
const NavigationTransitionParentEventTarget = Symbol.for("@virtualstate/navigation/transition/parentEventTarget");
const NavigationTransitionFinishedDeferred = Symbol.for("@virtualstate/navigation/transition/deferred/finished");
const NavigationTransitionCommittedDeferred = Symbol.for("@virtualstate/navigation/transition/deferred/committed");
const NavigationTransitionNavigationType = Symbol.for("@virtualstate/navigation/transition/navigationType");
const NavigationTransitionInitialEntries = Symbol.for("@virtualstate/navigation/transition/entries/initial");
const NavigationTransitionFinishedEntries = Symbol.for("@virtualstate/navigation/transition/entries/finished");
const NavigationTransitionInitialIndex = Symbol.for("@virtualstate/navigation/transition/index/initial");
const NavigationTransitionFinishedIndex = Symbol.for("@virtualstate/navigation/transition/index/finished");
const NavigationTransitionEntry = Symbol.for("@virtualstate/navigation/transition/entry");
const NavigationTransitionIsCommitted = Symbol.for("@virtualstate/navigation/transition/isCommitted");
const NavigationTransitionIsFinished = Symbol.for("@virtualstate/navigation/transition/isFinished");
const NavigationTransitionIsRejected = Symbol.for("@virtualstate/navigation/transition/isRejected");
const NavigationTransitionKnown = Symbol.for("@virtualstate/navigation/transition/known");
const NavigationTransitionPromises = Symbol.for("@virtualstate/navigation/transition/promises");
const NavigationIntercept = Symbol.for("@virtualstate/navigation/intercept");
const NavigationTransitionIsOngoing = Symbol.for("@virtualstate/navigation/transition/isOngoing");
const NavigationTransitionIsPending = Symbol.for("@virtualstate/navigation/transition/isPending");
const NavigationTransitionIsAsync = Symbol.for("@virtualstate/navigation/transition/isAsync");
const NavigationTransitionWait = Symbol.for("@virtualstate/navigation/transition/wait");
const NavigationTransitionPromiseResolved = Symbol.for("@virtualstate/navigation/transition/promise/resolved");
const NavigationTransitionRejected = Symbol.for("@virtualstate/navigation/transition/rejected");
const NavigationTransitionCommit = Symbol.for("@virtualstate/navigation/transition/commit");
const NavigationTransitionFinish = Symbol.for("@virtualstate/navigation/transition/finish");
const NavigationTransitionStart = Symbol.for("@virtualstate/navigation/transition/start");
const NavigationTransitionStartDeadline = Symbol.for("@virtualstate/navigation/transition/start/deadline");
const NavigationTransitionError = Symbol.for("@virtualstate/navigation/transition/error");
const NavigationTransitionFinally = Symbol.for("@virtualstate/navigation/transition/finally");
const NavigationTransitionAbort = Symbol.for("@virtualstate/navigation/transition/abort");
const NavigationTransitionInterceptOptionsCommit = Symbol.for("@virtualstate/navigation/transition/intercept/options/commit");
const NavigationTransitionCommitIsManual = Symbol.for("@virtualstate/navigation/transition/commit/isManual");
class NavigationTransition extends EventTarget {
    finished;
    /**
     * @experimental
     */
    committed;
    from;
    navigationType;
    /**
     * true if transition has an async intercept
     */
    [NavigationTransitionIsAsync] = false;
    /**
     * @experimental
     */
    [NavigationTransitionInterceptOptionsCommit];
    #options;
    [NavigationTransitionFinishedDeferred] = deferred();
    [NavigationTransitionCommittedDeferred] = deferred();
    get [NavigationTransitionIsPending]() {
        return !!this.#promises.size;
    }
    get [NavigationTransitionNavigationType]() {
        return this.#options[NavigationTransitionNavigationType];
    }
    get [NavigationTransitionInitialEntries]() {
        return this.#options[NavigationTransitionInitialEntries];
    }
    get [NavigationTransitionInitialIndex]() {
        return this.#options[NavigationTransitionInitialIndex];
    }
    get [NavigationTransitionCommitIsManual]() {
        return !!(this[NavigationTransitionInterceptOptionsCommit]?.includes("after-transition") ||
            this[NavigationTransitionInterceptOptionsCommit]?.includes("manual"));
    }
    [NavigationTransitionFinishedEntries];
    [NavigationTransitionFinishedIndex];
    [NavigationTransitionIsCommitted] = false;
    [NavigationTransitionIsFinished] = false;
    [NavigationTransitionIsRejected] = false;
    [NavigationTransitionIsOngoing] = false;
    [NavigationTransitionKnown] = new Set();
    [NavigationTransitionEntry];
    #promises = new Set();
    #rolledBack = false;
    #abortController = new AbortController$1();
    get signal() {
        return this.#abortController.signal;
    }
    get [NavigationTransitionPromises]() {
        return this.#promises;
    }
    constructor(init) {
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
                this.addEventListener(NavigationTransitionCommit, this.#onCommitPromise, { once: true });
                this.addEventListener(NavigationTransitionFinish, this.#onFinishPromise, { once: true });
            }
            // Events to property setters
            {
                this.addEventListener(NavigationTransitionCommit, this.#onCommitSetProperty, { once: true });
                this.addEventListener(NavigationTransitionFinish, this.#onFinishSetProperty, { once: true });
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
                this.addEventListener("*", this[NavigationTransitionEntry].dispatchEvent.bind(this[NavigationTransitionEntry]));
                this.addEventListener("*", init[NavigationTransitionParentEventTarget].dispatchEvent.bind(init[NavigationTransitionParentEventTarget]));
            }
        }
    }
    rollback = (options) => {
        // console.log({ rolled: this.#rolledBack });
        if (this.#rolledBack) {
            // TODO
            throw new InvalidStateError("Rollback invoked multiple times: Please raise an issue at https://github.com/virtualstate/navigation with the use case where you want to use a rollback multiple times, this may have been unexpected behaviour");
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
        this[NavigationTransitionFinishedDeferred].resolve(this[NavigationTransitionEntry]);
    };
    #onCommitPromise = () => {
        if (this.signal.aborted) ;
        else {
            this[NavigationTransitionCommittedDeferred].resolve(this[NavigationTransitionEntry]);
        }
    };
    #onError = (event) => {
        return this[NavigationTransitionRejected](event.error);
    };
    [NavigationTransitionPromiseResolved] = (...promises) => {
        for (const promise of promises) {
            this.#promises.delete(promise);
        }
    };
    [NavigationTransitionRejected] = async (reason) => {
        if (this[NavigationTransitionIsRejected])
            return;
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
            if (navigationType !== Rollback &&
                !(isInvalidStateError(reason) || isAbortError(reason))) {
                try {
                    // console.log("Rollback", navigationType);
                    // console.warn("Rolling back immediately due to internal error", error);
                    await this.rollback()?.finished;
                    // console.log("Rollback complete", navigationType);
                }
                catch (error) {
                    // console.error("Failed to rollback", error);
                    throw new InvalidStateError("Failed to rollback, please raise an issue at https://github.com/virtualstate/navigation/issues");
                }
            }
        }
        this[NavigationTransitionCommittedDeferred].reject(reason);
        this[NavigationTransitionFinishedDeferred].reject(reason);
    };
    [NavigationIntercept] = (options) => {
        const transition = this;
        const promise = parseOptions();
        this[NavigationTransitionIsOngoing] = true;
        if (!promise)
            return;
        this[NavigationTransitionIsAsync] = true;
        const statusPromise = promise
            .then(() => ({
            status: "fulfilled",
            value: undefined,
        }))
            .catch(async (reason) => {
            await this[NavigationTransitionRejected](reason);
            return {
                status: "rejected",
                reason,
            };
        });
        this.#promises.add(statusPromise);
        function parseOptions() {
            if (!options)
                return undefined;
            if (isPromise(options)) {
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
    [NavigationTransitionWait] = async () => {
        if (!this.#promises.size)
            return this[NavigationTransitionEntry];
        try {
            const captured = [...this.#promises];
            const results = await Promise.all(captured);
            const rejected = results.filter((result) => result.status === "rejected");
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
        }
        catch (error) {
            await this.#onError(error);
            throw await Promise.reject(error);
        }
        finally {
            await this[NavigationTransitionFinish]();
        }
    };
    [NavigationTransitionAbort]() {
        if (this.#abortController.signal.aborted)
            return;
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

function getWindowBaseURL() {
    try {
        if (typeof window !== "undefined" && window.location) {
            return window.location.href;
        }
    }
    catch { }
}
function getBaseURL(url) {
    const baseURL = getWindowBaseURL() ?? "https://html.spec.whatwg.org/";
    return new URL(
    // Deno wants this to be always a string
    (url ?? "").toString(), baseURL);
}

function defer() {
    let resolve = undefined, reject = undefined, settled = false, status = "pending";
    const promise = new Promise((resolveFn, rejectFn) => {
        resolve = (value) => {
            status = "fulfilled";
            settled = true;
            resolveFn(value);
        };
        reject = (reason) => {
            status = "rejected";
            settled = true;
            rejectFn(reason);
        };
    });
    ok(resolve);
    ok(reject);
    return {
        get settled() {
            return settled;
        },
        get status() {
            return status;
        },
        resolve,
        reject,
        promise,
    };
}

class NavigationCurrentEntryChangeEvent {
    type;
    from;
    navigationType;
    constructor(type, init) {
        this.type = type;
        if (!init) {
            throw new TypeError("init required");
        }
        if (!init.from) {
            throw new TypeError("from required");
        }
        this.from = init.from;
        this.navigationType = init.navigationType ?? undefined;
    }
}

class NavigateEvent {
    type;
    canIntercept;
    /**
     * @deprecated
     */
    canTransition;
    destination;
    downloadRequest;
    formData;
    hashChange;
    info;
    signal;
    userInitiated;
    navigationType;
    constructor(type, init) {
        this.type = type;
        if (!init) {
            throw new TypeError("init required");
        }
        if (!init.destination) {
            throw new TypeError("destination required");
        }
        if (!init.signal) {
            throw new TypeError("signal required");
        }
        this.canIntercept = init.canIntercept ?? false;
        this.canTransition = init.canIntercept ?? false;
        this.destination = init.destination;
        this.downloadRequest = init.downloadRequest;
        this.formData = init.formData;
        this.hashChange = init.hashChange ?? false;
        this.info = init.info;
        this.signal = init.signal;
        this.userInitiated = init.userInitiated ?? false;
        this.navigationType = init.navigationType ?? "push";
    }
    commit() {
        throw new Error("Not implemented");
    }
    intercept(options) {
        throw new Error("Not implemented");
    }
    preventDefault() {
        throw new Error("Not implemented");
    }
    reportError(reason) {
        throw new Error("Not implemented");
    }
    scroll() {
        throw new Error("Not implemented");
    }
    /**
     * @deprecated
     */
    transitionWhile(options) {
        return this.intercept(options);
    }
}

const NavigationFormData = Symbol.for("@virtualstate/navigation/formData");
const NavigationDownloadRequest = Symbol.for("@virtualstate/navigation/downloadRequest");
const NavigationCanIntercept = Symbol.for("@virtualstate/navigation/canIntercept");
const NavigationUserInitiated = Symbol.for("@virtualstate/navigation/userInitiated");
const NavigationOriginalEvent = Symbol.for("@virtualstate/navigation/originalEvent");
function noop() {
    return undefined;
}
function getEntryIndex(entries, entry) {
    const knownIndex = entry.index;
    if (knownIndex !== -1) {
        return knownIndex;
    }
    // TODO find an entry if it has changed id
    return -1;
}
function createNavigationTransition(context) {
    const { commit: transitionCommit, currentIndex, options, known: initialKnown, currentEntry, transition, transition: { [NavigationTransitionInitialEntries]: previousEntries, [NavigationTransitionEntry]: entry, [NavigationIntercept]: intercept, }, reportError } = context;
    let { transition: { [NavigationTransitionNavigationType]: navigationType }, } = context;
    let resolvedEntries = [...previousEntries];
    const known = new Set(initialKnown);
    let destinationIndex = -1, nextIndex = currentIndex;
    if (navigationType === Rollback) {
        const { index } = options ?? { index: undefined };
        if (typeof index !== "number")
            throw new InvalidStateError("Expected index to be provided for rollback");
        destinationIndex = index;
        nextIndex = index;
    }
    else if (navigationType === "traverse" || navigationType === "reload") {
        destinationIndex = getEntryIndex(previousEntries, entry);
        nextIndex = destinationIndex;
    }
    else if (navigationType === "replace") {
        if (currentIndex === -1) {
            navigationType = "push";
            destinationIndex = currentIndex + 1;
            nextIndex = destinationIndex;
        }
        else {
            destinationIndex = currentIndex;
            nextIndex = currentIndex;
        }
    }
    else {
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
    const destination = {
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
        const currentUrlInstanceWithoutHash = new URL(currentUrlInstance.toString());
        currentUrlInstanceWithoutHash.hash = "";
        const destinationUrlInstanceWithoutHash = new URL(destinationUrlInstance.toString());
        destinationUrlInstanceWithoutHash.hash = "";
        hashChange =
            currentUrlInstanceWithoutHash.toString() ===
                destinationUrlInstanceWithoutHash.toString();
        // console.log({ hashChange, currentUrlInstanceWithoutHash: currentUrlInstanceWithoutHash.toString(), before: destinationUrlInstanceWithoutHash.toString() })
    }
    let contextToCommit;
    const { resolve: resolveCommit, promise: waitForCommit } = defer();
    function commit() {
        ok(contextToCommit, "Expected contextToCommit");
        resolveCommit(transitionCommit(contextToCommit));
    }
    const abortController = new AbortController$1();
    const event = new NavigateEvent("navigate", {
        signal: abortController.signal,
        info: undefined,
        ...options,
        canIntercept: options?.[NavigationCanIntercept] ?? true,
        formData: options?.[NavigationFormData] ?? undefined,
        downloadRequest: options?.[NavigationDownloadRequest] ?? undefined,
        hashChange,
        navigationType: options?.navigationType ??
            (typeof navigationType === "string" ? navigationType : "replace"),
        userInitiated: options?.[NavigationUserInitiated] ?? false,
        destination,
    });
    const originalEvent = options?.[NavigationOriginalEvent];
    const preventDefault = transition[NavigationTransitionAbort].bind(transition);
    if (originalEvent) {
        const definedEvent = originalEvent;
        event.intercept = function originalEventIntercept(options) {
            definedEvent.preventDefault();
            return intercept(options);
        };
        event.preventDefault = function originalEventPreventDefault() {
            definedEvent.preventDefault();
            return preventDefault();
        };
    }
    else {
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
    let updatedEntries = [], removedEntries = [], addedEntries = [];
    const previousKeys = previousEntries.map(entry => entry.key);
    if (navigationType === Rollback) {
        const { entries } = options ?? { entries: undefined };
        if (!entries)
            throw new InvalidStateError("Expected entries to be provided for rollback");
        resolvedEntries = entries;
        resolvedEntries.forEach((entry) => known.add(entry));
        const keys = resolvedEntries.map(entry => entry.key);
        removedEntries = previousEntries.filter(entry => !keys.includes(entry.key));
        addedEntries = resolvedEntries.filter(entry => !previousKeys.includes(entry.key));
    }
    // Default next index is current entries length, aka
    // console.log({ navigationType, givenNavigationType, index: this.#currentIndex, resolvedNextIndex });
    else if (navigationType === "replace" ||
        navigationType === "traverse" ||
        navigationType === "reload") {
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
    }
    else if (navigationType === "push") {
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
    let entriesChange = undefined;
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

function createEvent(event) {
    if (typeof CustomEvent !== "undefined" && typeof event.type === "string") {
        if (event instanceof CustomEvent) {
            return event;
        }
        const { type, detail, ...rest } = event;
        const customEvent = new CustomEvent(type, {
            detail: detail ?? rest,
        });
        Object.assign(customEvent, rest);
        assertEvent(customEvent, event.type);
        return customEvent;
    }
    return event;
}

const NavigationSetOptions = Symbol.for("@virtualstate/navigation/setOptions");
const NavigationSetEntries = Symbol.for("@virtualstate/navigation/setEntries");
const NavigationSetCurrentIndex = Symbol.for("@virtualstate/navigation/setCurrentIndex");
const NavigationSetCurrentKey = Symbol.for("@virtualstate/navigation/setCurrentKey");
const NavigationGetState = Symbol.for("@virtualstate/navigation/getState");
const NavigationSetState = Symbol.for("@virtualstate/navigation/setState");
const NavigationDisposeState = Symbol.for("@virtualstate/navigation/disposeState");
function isNavigationNavigationType(value) {
    return (value === "reload" ||
        value === "push" ||
        value === "replace" ||
        value === "traverse");
}
class Navigation extends NavigationEventTarget {
    // Should be always 0 or 1
    #transitionInProgressCount = 0;
    // #activePromise?: Promise<void> = undefined;
    #entries = [];
    #known = new Set();
    #currentIndex = -1;
    #activeTransition;
    #knownTransitions = new WeakSet();
    #baseURL = "";
    #initialEntry = undefined;
    #options = undefined;
    get canGoBack() {
        return !!this.#entries[this.#currentIndex - 1];
    }
    get canGoForward() {
        return !!this.#entries[this.#currentIndex + 1];
    }
    get currentEntry() {
        if (this.#currentIndex === -1) {
            if (!this.#initialEntry) {
                this.#initialEntry = new NavigationHistoryEntry({
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
    get transition() {
        const transition = this.#activeTransition;
        // Never let an aborted transition leak, it doesn't need to be accessed any more
        return transition?.signal.aborted ? undefined : transition;
    }
    constructor(options = {}) {
        super();
        this[NavigationSetOptions](options);
    }
    [NavigationSetOptions](options) {
        this.#options = options;
        this.#baseURL = getBaseURL(options?.baseURL);
        this.#entries = [];
        if (options.entries) {
            this[NavigationSetEntries](options.entries);
        }
        if (options.currentKey) {
            this[NavigationSetCurrentKey](options.currentKey);
        }
        else if (typeof options.currentIndex === "number") {
            this[NavigationSetCurrentIndex](options.currentIndex);
        }
    }
    /**
     * Set the current entry key without any lifecycle eventing
     *
     * This would be more exact than providing an index
     * @param key
     */
    [NavigationSetCurrentKey](key) {
        const index = this.#entries.findIndex(entry => entry.key === key);
        // If the key can't be found, becomes a no-op
        if (index === -1)
            return;
        this.#currentIndex = index;
    }
    /**
     * Set the current entry index without any lifecycle eventing
     * @param index
     */
    [NavigationSetCurrentIndex](index) {
        if (index <= -1)
            return;
        if (index >= this.#entries.length)
            return;
        this.#currentIndex = index;
    }
    /**
     * Set the entries available without any lifecycle eventing
     * @param entries
     */
    [NavigationSetEntries](entries) {
        this.#entries = entries.map(({ key, url, navigationType, state, sameDocument }, index) => new NavigationHistoryEntry({
            getState: this[NavigationGetState],
            navigationType: isNavigationNavigationType(navigationType) ? navigationType : "push",
            sameDocument: sameDocument ?? true,
            index,
            url,
            key,
            state
        }));
        if (this.#currentIndex === -1 && this.#entries.length) {
            // Initialise, even if its not the one that was expected
            this.#currentIndex = 0;
        }
    }
    [NavigationGetState] = (entry) => {
        return this.#options?.getState?.(entry) ?? undefined;
    };
    [NavigationSetState] = (entry) => {
        return this.#options?.setState?.(entry);
    };
    [NavigationDisposeState] = (entry) => {
        return this.#options?.disposeState?.(entry);
    };
    back(options) {
        if (!this.canGoBack)
            throw new InvalidStateError("Cannot go back");
        const entry = this.#entries[this.#currentIndex - 1];
        return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(entry, {
            ...options,
            navigationType: "traverse",
        }));
    }
    entries() {
        return [...this.#entries];
    }
    forward(options) {
        if (!this.canGoForward)
            throw new InvalidStateError();
        const entry = this.#entries[this.#currentIndex + 1];
        return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(entry, {
            ...options,
            navigationType: "traverse",
        }));
    }
    /**
    /**
     * @deprecated use traverseTo
     */
    goTo(key, options) {
        return this.traverseTo(key, options);
    }
    traverseTo(key, options) {
        const found = this.#entries.find((entry) => entry.key === key);
        if (found) {
            return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(found, {
                ...options,
                navigationType: "traverse",
            }));
        }
        throw new InvalidStateError();
    }
    #isSameDocument = (url) => {
        function isSameOrigins(a, b) {
            return a.origin === b.origin;
        }
        const currentEntryUrl = this.currentEntry?.url;
        if (!currentEntryUrl)
            return true;
        return isSameOrigins(new URL(currentEntryUrl), new URL(url));
    };
    navigate(url, options) {
        let baseURL = this.#baseURL;
        if (this.currentEntry?.url) {
            // This allows use to use relative
            baseURL = this.currentEntry?.url;
        }
        const nextUrl = new URL(url, baseURL).toString();
        let navigationType = "push";
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
    #cloneNavigationHistoryEntry = (entry, options) => {
        return this.#createNavigationHistoryEntry({
            ...entry,
            getState: this[NavigationGetState],
            index: entry?.index ?? undefined,
            state: options?.state ?? entry?.getState(),
            navigationType: entry?.[NavigationHistoryEntryNavigationType] ??
                (typeof options?.navigationType === "string"
                    ? options.navigationType
                    : "replace"),
            ...options,
            get [NavigationHistoryEntryKnownAs]() {
                return entry?.[NavigationHistoryEntryKnownAs];
            },
            get [EventTargetListeners$1]() {
                return entry?.[EventTargetListeners$1];
            },
        });
    };
    #createNavigationHistoryEntry = (options) => {
        const entry = new NavigationHistoryEntry({
            ...options,
            index: options.index ??
                (() => {
                    return this.#entries.indexOf(entry);
                }),
        });
        return entry;
    };
    #pushEntry = (navigationType, entry, transition, options) => {
        /* c8 ignore start */
        if (entry === this.currentEntry)
            throw new InvalidStateError();
        const existingPosition = this.#entries.findIndex((existing) => existing.id === entry.id);
        if (existingPosition > -1) {
            throw new InvalidStateError();
        }
        /* c8 ignore end */
        return this.#commitTransition(navigationType, entry, transition, options);
    };
    #commitTransition = (givenNavigationType, entry, transition, options) => {
        const nextTransition = transition ??
            new NavigationTransition({
                from: entry,
                navigationType: typeof givenNavigationType === "string"
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
            return this.#immediateTransition(givenNavigationType, entry, nextTransition, options);
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
    #queueTransition = (transition) => {
        // TODO consume errors that are not abort errors
        // transition.finished.catch(error => void error);
        this.#knownTransitions.add(transition);
    };
    #immediateTransition = (givenNavigationType, entry, transition, options) => {
        try {
            // This number can grow if navigation is
            // called during a transition
            //
            // ... I had used transitionInProgressCount as a
            // safeguard until I could see this flow firsthand
            this.#transitionInProgressCount += 1;
            return this.#transition(givenNavigationType, entry, transition, options);
        }
        finally {
            this.#transitionInProgressCount -= 1;
        }
    };
    #rollback = (rollbackTransition, options) => {
        const previousEntries = rollbackTransition[NavigationTransitionInitialEntries];
        const previousIndex = rollbackTransition[NavigationTransitionInitialIndex];
        const previousCurrent = previousEntries[previousIndex];
        // console.log("z");
        // console.log("Rollback!", { previousCurrent, previousEntries, previousIndex });
        const entry = previousCurrent
            ? this.#cloneNavigationHistoryEntry(previousCurrent, options)
            : undefined;
        const nextOptions = {
            ...options,
            index: previousIndex,
            known: new Set([...this.#known, ...previousEntries]),
            navigationType: entry?.[NavigationHistoryEntryNavigationType] ?? "replace",
            entries: previousEntries,
        };
        const resolvedNavigationType = entry ? Rollback : Unset;
        const resolvedEntry = entry ??
            this.#createNavigationHistoryEntry({
                getState: this[NavigationGetState],
                navigationType: "replace",
                index: nextOptions.index,
                sameDocument: true,
                ...options,
            });
        return this.#pushEntry(resolvedNavigationType, resolvedEntry, undefined, nextOptions);
    };
    #transition = (givenNavigationType, entry, transition, options) => {
        // console.log({ givenNavigationType, transition });
        let navigationType = givenNavigationType;
        const performance = getPerformance();
        if (performance &&
            entry.sameDocument &&
            typeof navigationType === "string") {
            performance?.mark?.(`same-document-navigation:${entry.id}`);
        }
        let currentEntryChangeEvent = false, committedCurrentEntryChange = false;
        const { currentEntry } = this;
        void this.#activeTransition?.finished?.catch((error) => error);
        void this.#activeTransition?.[NavigationTransitionFinishedDeferred]?.promise?.catch((error) => error);
        void this.#activeTransition?.[NavigationTransitionCommittedDeferred]?.promise?.catch((error) => error);
        this.#activeTransition?.[NavigationTransitionAbort]();
        this.#activeTransition = transition;
        const startEventPromise = transition.dispatchEvent({
            type: NavigationTransitionStart,
            transition,
            entry,
        });
        const syncCommit = ({ entries, index, known }) => {
            if (transition.signal.aborted)
                return;
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
        const asyncCommit = async (commit) => {
            if (committedCurrentEntryChange) {
                return;
            }
            committedCurrentEntryChange = true;
            syncCommit(commit);
            const { entriesChange } = commit;
            const promises = [
                transition.dispatchEvent(createEvent({
                    type: NavigationTransitionCommit,
                    transition,
                    entry,
                }))
            ];
            if (entriesChange) {
                promises.push(this.dispatchEvent(createEvent({
                    type: "entrieschange",
                    ...entriesChange
                })));
            }
            await Promise.all(promises);
        };
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
            await this.dispatchEvent(createEvent({
                type: "currententrychange",
            }));
            currentEntryChangeEvent = true;
            return entry;
        };
        const completeTransition = () => {
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
            const microtask = new Promise(queueMicrotask);
            let promises = [];
            const iterator = transitionSteps(transitionResult)[Symbol.iterator]();
            const iterable = {
                [Symbol.iterator]: () => ({ next: () => iterator.next() }),
            };
            async function syncTransition() {
                for (const promise of iterable) {
                    if (isPromise(promise)) {
                        promises.push(Promise.allSettled([
                            promise
                        ]).then(([result]) => result));
                    }
                    if (transition[NavigationTransitionCommitIsManual] ||
                        (currentEntryChangeEvent && transition[NavigationTransitionIsAsync])) {
                        return asyncTransition().then(syncTransition);
                    }
                    if (transition.signal.aborted) {
                        break;
                    }
                }
                if (promises.length) {
                    return asyncTransition();
                }
            }
            async function asyncTransition() {
                const captured = [...promises];
                if (captured.length) {
                    promises = [];
                    const results = await Promise.all(captured);
                    const rejected = results.filter(isPromiseRejectedResult);
                    if (rejected.length === 1) {
                        throw await Promise.reject(rejected[0]);
                    }
                    else if (rejected.length) {
                        throw new AggregateError(rejected, rejected[0].reason?.message);
                    }
                }
                else if (!transition[NavigationTransitionIsOngoing]) {
                    await microtask;
                }
            }
            // console.log("Returning", { entry });
            return syncTransition()
                .then(() => transition[NavigationTransitionIsOngoing] ? undefined : microtask)
                .then(() => entry);
        };
        const dispose = async () => this.#dispose();
        function* transitionSteps(transitionResult) {
            const microtask = new Promise(queueMicrotask);
            const { currentEntryChange, navigate, waitForCommit, commit, abortController } = transitionResult;
            const navigateAbort = abortController.abort.bind(abortController);
            transition.signal.addEventListener("abort", navigateAbort, {
                once: true,
            });
            if (typeof navigationType === "string" || navigationType === Rollback) {
                const promise = currentEntry?.dispatchEvent(createEvent({
                    type: "navigatefrom",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
                if (promise)
                    yield promise;
            }
            if (typeof navigationType === "string") {
                yield transition.dispatchEvent(navigate);
            }
            if (!transition[NavigationTransitionCommitIsManual]) {
                commit();
            }
            yield waitForCommit;
            if (entry.sameDocument) {
                yield transition.dispatchEvent(currentEntryChange);
            }
            currentEntryChangeEvent = true;
            if (typeof navigationType === "string") {
                yield entry.dispatchEvent(createEvent({
                    type: "navigateto",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
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
                yield transition.dispatchEvent(createEvent({
                    type: "finish",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
                yield transition.dispatchEvent(createEvent({
                    type: "navigatesuccess",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
            }
        }
        const maybeSyncTransition = () => {
            try {
                return completeTransition();
            }
            catch (error) {
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
                performance.measure(`same-document-navigation:${entry.url}`, `same-document-navigation:${entry.id}`, `same-document-navigation-finish:${entry.id}`);
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
    reload(options) {
        const { currentEntry } = this;
        if (!currentEntry)
            throw new InvalidStateError();
        const entry = this.#cloneNavigationHistoryEntry(currentEntry, options);
        return this.#pushEntry("reload", entry, undefined, options);
    }
    updateCurrentEntry(options) {
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
        const entriesChange = createEvent({
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
        ]);
    }
}
function getPerformance() {
    if (typeof performance !== "undefined") {
        return performance;
    }
    /* c8 ignore start */
    return {
        now() {
            return Date.now();
        },
        mark() { },
        measure() { },
    };
    // const { performance: nodePerformance } = await import("perf_hooks");
    // return nodePerformance;
    /* c8 ignore end */
}

const AppLocationCheckChange = Symbol.for("@virtualstate/navigation/location/checkChange");
const AppLocationAwaitFinished = Symbol.for("@virtualstate/navigation/location/awaitFinished");
const AppLocationTransitionURL = Symbol.for("@virtualstate/navigation/location/transitionURL");
const AppLocationUrl = Symbol.for("@virtualstate/navigation/location/url");
const NAVIGATION_LOCATION_DEFAULT_URL = "https://html.spec.whatwg.org/";
/**
 * @experimental
 */
class NavigationLocation {
    #options;
    #navigation;
    constructor(options) {
        this.#options = options;
        this.#navigation = options.navigation;
        const reset = () => {
            this.#transitioningURL = undefined;
            this.#baseURL = undefined;
        };
        this.#navigation.addEventListener("navigate", () => {
            const transition = this.#navigation.transition;
            if (transition && isCommittedAvailable(transition)) {
                transition[NavigationTransitionCommittedDeferred].promise.then(reset, reset);
            }
            function isCommittedAvailable(transition) {
                return NavigationTransitionCommittedDeferred in transition;
            }
        });
        this.#navigation.addEventListener("currententrychange", reset);
    }
    #urls = new WeakMap();
    #transitioningURL;
    #baseURL;
    get [AppLocationUrl]() {
        if (this.#transitioningURL) {
            return this.#transitioningURL;
        }
        const { currentEntry } = this.#navigation;
        if (!currentEntry) {
            this.#baseURL = getBaseURL(this.#options.baseURL);
            return this.#baseURL;
        }
        const existing = this.#urls.get(currentEntry);
        if (existing)
            return existing;
        const next = new URL(currentEntry.url ?? NAVIGATION_LOCATION_DEFAULT_URL);
        this.#urls.set(currentEntry, next);
        return next;
    }
    get hash() {
        return this[AppLocationUrl].hash;
    }
    set hash(value) {
        this.#setUrlValue("hash", value);
    }
    get host() {
        return this[AppLocationUrl].host;
    }
    set host(value) {
        this.#setUrlValue("host", value);
    }
    get hostname() {
        return this[AppLocationUrl].hostname;
    }
    set hostname(value) {
        this.#setUrlValue("hostname", value);
    }
    get href() {
        return this[AppLocationUrl].href;
    }
    set href(value) {
        this.#setUrlValue("href", value);
    }
    get origin() {
        return this[AppLocationUrl].origin;
    }
    get pathname() {
        return this[AppLocationUrl].pathname;
    }
    set pathname(value) {
        this.#setUrlValue("pathname", value);
    }
    get port() {
        return this[AppLocationUrl].port;
    }
    set port(value) {
        this.#setUrlValue("port", value);
    }
    get protocol() {
        return this[AppLocationUrl].protocol;
    }
    set protocol(value) {
        this.#setUrlValue("protocol", value);
    }
    get search() {
        return this[AppLocationUrl].search;
    }
    set search(value) {
        this.#setUrlValue("search", value);
    }
    #setUrlValue = (key, value) => {
        const currentUrlString = this[AppLocationUrl].toString();
        let nextUrl;
        if (key === "href") {
            nextUrl = new URL(value, currentUrlString);
        }
        else {
            nextUrl = new URL(currentUrlString);
            nextUrl[key] = value;
        }
        const nextUrlString = nextUrl.toString();
        if (currentUrlString === nextUrlString) {
            return;
        }
        void this.#transitionURL(nextUrl, () => this.#navigation.navigate(nextUrlString));
    };
    replace(url) {
        return this.#transitionURL(url, (url) => this.#navigation.navigate(url.toString(), {
            history: "replace",
        }));
    }
    reload() {
        return this.#awaitFinished(this.#navigation.reload());
    }
    assign(url) {
        return this.#transitionURL(url, (url) => this.#navigation.navigate(url.toString()));
    }
    [AppLocationTransitionURL](url, fn) {
        return this.#transitionURL(url, fn);
    }
    #transitionURL = async (url, fn) => {
        const instance = (this.#transitioningURL =
            typeof url === "string"
                ? new URL(url, this[AppLocationUrl].toString())
                : url);
        try {
            await this.#awaitFinished(fn(instance));
        }
        finally {
            if (this.#transitioningURL === instance) {
                this.#transitioningURL = undefined;
            }
        }
    };
    [AppLocationAwaitFinished](result) {
        return this.#awaitFinished(result);
    }
    #awaitFinished = async (result) => {
        this.#baseURL = undefined;
        if (!result)
            return;
        const { committed, finished } = result;
        await Promise.all([
            committed || Promise.resolve(undefined),
            finished || Promise.resolve(undefined),
        ]);
    };
    #triggerIfUrlChanged = () => {
        const current = this[AppLocationUrl];
        const currentUrl = current.toString();
        const expectedUrl = this.#navigation.currentEntry?.url;
        if (currentUrl !== expectedUrl) {
            return this.#transitionURL(current, () => this.#navigation.navigate(currentUrl));
        }
    };
    /**
     * This is needed if you have changed searchParams using its mutating methods
     *
     * TODO replace get searchParams with an observable change to auto trigger this function
     */
    [AppLocationCheckChange]() {
        return this.#triggerIfUrlChanged();
    }
}

const State = Symbol.for("@virtualstate/navigation/history/state");
/**
 * @experimental
 */
class NavigationHistory extends NavigationLocation {
    #options;
    #navigation;
    constructor(options) {
        super(options);
        this.#options = options;
        this.#navigation = options.navigation;
    }
    get length() {
        return this.#navigation.entries().length;
    }
    scrollRestoration = "manual";
    get state() {
        const currentState = this.#navigation.currentEntry?.getState();
        if (typeof currentState === "string" || typeof currentState === "number" || typeof currentState === "boolean") {
            return currentState;
        }
        return this.#options[State] ?? undefined;
    }
    back() {
        const entries = this.#navigation.entries();
        const index = this.#navigation.currentEntry?.index ?? -1;
        const back = entries[index - 1];
        const url = back?.url;
        if (!url)
            throw new InvalidStateError("Cannot go back");
        return this[AppLocationTransitionURL](url, () => this.#navigation.back());
    }
    forward() {
        const entries = this.#navigation.entries();
        const index = this.#navigation.currentEntry?.index ?? -1;
        const forward = entries[index + 1];
        const url = forward?.url;
        if (!url)
            throw new InvalidStateError("Cannot go forward");
        return this[AppLocationTransitionURL](url, () => this.#navigation.forward());
    }
    go(delta) {
        if (typeof delta !== "number" || delta === 0 || isNaN(delta)) {
            return this[AppLocationAwaitFinished](this.#navigation.reload());
        }
        const entries = this.#navigation.entries();
        const { currentEntry } = this.#navigation;
        if (!currentEntry) {
            throw new Error(`Could not go ${delta}`);
        }
        const nextIndex = currentEntry.index + delta;
        const nextEntry = entries[nextIndex];
        if (!nextEntry) {
            throw new Error(`Could not go ${delta}`);
        }
        const nextEntryKey = nextEntry.key;
        return this[AppLocationAwaitFinished](this.#navigation.traverseTo(nextEntryKey));
    }
    replaceState(data, unused, url) {
        if (url) {
            return this[AppLocationTransitionURL](url, (url) => this.#navigation.navigate(url.toString(), {
                state: data,
                history: "replace",
            }));
        }
        else {
            return this.#navigation.updateCurrentEntry({
                state: data
            });
        }
    }
    pushState(data, unused, url) {
        if (url) {
            return this[AppLocationTransitionURL](url, (url) => this.#navigation.navigate(url.toString(), {
                state: data,
            }));
        }
        else {
            return this.#navigation.updateCurrentEntry({
                state: data,
            });
        }
    }
}
/**
 * @experimental
 * @internal
 */
class NavigationSync extends NavigationHistory {
}

async function transition(navigation) {
    let transition = undefined;
    let finalPromise;
    while (navigation.transition && transition !== navigation.transition) {
        transition = navigation.transition;
        finalPromise = transition.finished;
        await finalPromise.catch(error => void error);
    }
    return finalPromise;
}

/** post rollup replace json **/
const structuredClone = (await getStructuredCloneModule()
    .catch(structuredCloneFallback));
const getStructuredClone = () => structuredClone;
/** post rollup replace json **/
async function getStructuredCloneModule() {
    const { stringify, parse } = await Promise.resolve().then(function () { return json; });
    return { stringify, parse };
}
function structuredCloneFallback() {
    const stringify = JSON.stringify.bind(JSON), parse = JSON.parse.bind(JSON);
    return {
        stringify,
        parse
    };
}
function stringify$2(value) {
    return getStructuredClone().stringify(value);
}
function parse$2(value) {
    return getStructuredClone().parse(value);
}

const globalWindow = typeof window === "undefined" ? undefined : window;

const globalSelf = typeof self === "undefined" ? undefined : self;

const NavigationKey = "__@virtualstate/navigation/key";
const NavigationMeta = "__@virtualstate/navigation/meta";
function getWindowHistory(givenWindow = globalWindow) {
    if (typeof givenWindow === "undefined")
        return undefined;
    return givenWindow.history;
}
function isStateHistoryMeta(state) {
    return like(state) && state[NavigationMeta] === true;
}
function isStateHistoryWithMeta(state) {
    return like(state) && isStateHistoryMeta(state[NavigationKey]);
}
function disposeHistoryState(entry, persist) {
    if (!persist)
        return;
    if (typeof sessionStorage === "undefined")
        return;
    sessionStorage.removeItem(entry.key);
}
function getEntries(navigation, limit = DEFAULT_POLYFILL_OPTIONS.limit) {
    let entries = navigation.entries();
    if (typeof limit === "number") {
        entries = entries.slice(-limit);
    }
    return entries.map(({ id, key, url, sameDocument }) => ({
        id,
        key,
        url,
        sameDocument
    }));
}
function getNavigationEntryMeta(navigation, entry, limit = DEFAULT_POLYFILL_OPTIONS.limit) {
    return {
        [NavigationMeta]: true,
        currentIndex: entry.index,
        key: entry.key,
        entries: getEntries(navigation, limit),
        state: entry.getState()
    };
}
function getNavigationEntryWithMeta(navigation, entry, limit = DEFAULT_POLYFILL_OPTIONS.limit) {
    return {
        [NavigationKey]: getNavigationEntryMeta(navigation, entry, limit)
    };
}
function setHistoryState(navigation, history, entry, persist, limit) {
    setStateInSession();
    function getSerializableState() {
        return getNavigationEntryWithMeta(navigation, entry, limit);
    }
    function setStateInSession() {
        if (typeof sessionStorage === "undefined")
            return;
        try {
            const raw = stringify$2(getSerializableState());
            sessionStorage.setItem(entry.key, raw);
        }
        catch { }
    }
}
function getHistoryState(history, entry) {
    return (getStateFromHistoryIfMatchingKey() ??
        getStateFromSession());
    function getStateFromHistoryDirectly() {
        try {
            return history.state;
        }
        catch {
            return undefined;
        }
    }
    function getBaseState() {
        const value = (history.originalState ??
            getStateFromHistoryDirectly());
        return like(value) ? value : undefined;
    }
    function getStateFromHistoryIfMatchingKey() {
        const state = getBaseState();
        if (!isStateHistoryWithMeta(state))
            return undefined;
        if (state[NavigationKey].key !== entry.key)
            return undefined;
        return state[NavigationKey].state;
    }
    function getStateFromSession() {
        if (typeof sessionStorage === "undefined")
            return undefined;
        try {
            const raw = sessionStorage.getItem(entry.key);
            if (!raw)
                return undefined;
            const state = parse$2(raw);
            if (!isStateHistoryWithMeta(state))
                return undefined;
            return state[NavigationKey].state;
        }
        catch {
            return undefined;
        }
    }
}
const DEFAULT_POLYFILL_OPTIONS = Object.freeze({
    persist: true,
    persistState: true,
    history: true,
    limit: 50,
    patch: true,
    interceptEvents: true
});
function getPolyfill(options = DEFAULT_POLYFILL_OPTIONS) {
    const { navigation } = getCompletePolyfill(options);
    return navigation;
}
function isNavigationPolyfill(navigation) {
    return (like(navigation) &&
        typeof navigation[NavigationSetEntries] === "function" &&
        typeof navigation[NavigationSetCurrentKey] === "function");
}
function getNavigationOnlyPolyfill(givenNavigation) {
    // When using as a polyfill, we will auto initiate a single
    // entry, but not cause an event for it
    const entries = [
        {
            key: v4$2()
        }
    ];
    const navigation = givenNavigation ?? new Navigation({
        entries
    });
    const history = new NavigationHistory({
        navigation
    });
    return {
        navigation,
        history,
        apply() {
            if (isNavigationPolyfill(givenNavigation) && !navigation.entries().length) {
                givenNavigation[NavigationSetEntries](entries);
            }
        }
    };
}
function interceptWindowClicks(navigation, window) {
    function clickCallback(ev, aEl) {
        // console.log("<-- clickCallback -->");
        // TODO opt into queueMicrotask before process
        process();
        function process() {
            if (!isAppNavigation(ev))
                return;
            ok(ev);
            const options = {
                history: "auto",
                [NavigationUserInitiated]: true,
                [NavigationDownloadRequest]: aEl.download,
                [NavigationOriginalEvent]: ev,
            };
            navigation.navigate(aEl.href, options);
        }
    }
    function submitCallback(ev, form) {
        // console.log("<-- submitCallback -->");
        // TODO opt into queueMicrotask before process
        process();
        function process() {
            if (ev.defaultPrevented)
                return;
            const method = ev.submitter && 'formMethod' in ev.submitter && ev.submitter.formMethod
                ? ev.submitter.formMethod
                : form.method;
            // XXX: safe to ignore dialog method?
            if (method === 'dialog')
                return;
            const action = ev.submitter && 'formAction' in ev.submitter && ev.submitter.formAction
                ? ev.submitter.formAction
                : form.action;
            let formData;
            /* c8 ignore start */
            try {
                formData = new FormData(form);
            }
            catch {
                // For runtimes where we polyfilled the window & then evented it
                // ... for some reason
                formData = new FormData(undefined);
            }
            /* c8 ignore end */
            const params = method === 'get'
                ? new URLSearchParams([...formData].map(([k, v]) => v instanceof File ? [k, v.name] : [k, v]))
                : undefined;
            const navFormData = method === 'post'
                ? formData
                : undefined;
            // action is always a fully qualified url in browsers
            const url = new URL(action, navigation.currentEntry.url);
            if (params)
                url.search = params.toString();
            const unknownEvent = ev;
            ok(unknownEvent);
            const options = {
                history: "auto",
                [NavigationUserInitiated]: true,
                [NavigationFormData]: navFormData,
                [NavigationOriginalEvent]: unknownEvent,
            };
            navigation.navigate(url.href, options);
        }
    }
    // console.log("click event added")
    window.addEventListener("click", (ev) => {
        // console.log("click event", ev)
        if (ev.target?.ownerDocument === window.document) {
            const aEl = getAnchorFromEvent(ev); // XXX: not sure what <a> tags without href do
            if (like(aEl)) {
                clickCallback(ev, aEl);
            }
        }
    });
    window.addEventListener("submit", (ev) => {
        // console.log("submit event")
        if (ev.target?.ownerDocument === window.document) {
            const form = getFormFromEvent(ev);
            if (like(form)) {
                submitCallback(ev, form);
            }
        }
    });
}
function getAnchorFromEvent(event) {
    return matchesAncestor(getComposedPathTarget(event), "a[href]:not([data-navigation-ignore])");
}
function getFormFromEvent(event) {
    return matchesAncestor(getComposedPathTarget(event), "form:not([data-navigation-ignore])");
}
function getComposedPathTarget(event) {
    if (!event.composedPath) {
        return event.target;
    }
    const targets = event.composedPath();
    return targets[0] ?? event.target;
}
function patchGlobalScope(window, history, navigation) {
    patchGlobals();
    patchPopState();
    patchHistory();
    function patchWindow(window) {
        try {
            Object.defineProperty(window, "navigation", {
                value: navigation,
            });
        }
        catch (e) { }
        if (!window.history) {
            try {
                Object.defineProperty(window, "history", {
                    value: history,
                });
            }
            catch (e) { }
        }
    }
    function patchGlobals() {
        patchWindow(window);
        // If we don't have the global window, don't also patch global scope
        if (window !== globalWindow)
            return;
        if (globalSelf) {
            try {
                Object.defineProperty(globalSelf, "navigation", {
                    value: navigation,
                });
            }
            catch (e) { }
        }
        if (typeof globalThis !== "undefined") {
            try {
                Object.defineProperty(globalThis, "navigation", {
                    value: navigation,
                });
            }
            catch (e) { }
        }
    }
    function patchHistory() {
        if (history instanceof NavigationHistory) {
            // It's our polyfill, but probably externally passed to getPolyfill
            return;
        }
        const polyfillHistory = new NavigationHistory({
            navigation
        });
        const pushState = polyfillHistory.pushState.bind(polyfillHistory);
        const replaceState = polyfillHistory.replaceState.bind(polyfillHistory);
        const go = polyfillHistory.go.bind(polyfillHistory);
        const back = polyfillHistory.back.bind(polyfillHistory);
        const forward = polyfillHistory.forward.bind(polyfillHistory);
        const prototype = Object.getPrototypeOf(history);
        const descriptor = {
            pushState: {
                ...Object.getOwnPropertyDescriptor(prototype, "pushState"),
                value: pushState
            },
            replaceState: {
                ...Object.getOwnPropertyDescriptor(prototype, "replaceState"),
                value: replaceState
            },
            go: {
                ...Object.getOwnPropertyDescriptor(prototype, "go"),
                value: go
            },
            back: {
                ...Object.getOwnPropertyDescriptor(prototype, "back"),
                value: back
            },
            forward: {
                ...Object.getOwnPropertyDescriptor(prototype, "forward"),
                value: forward
            }
        };
        Object.defineProperties(prototype, descriptor);
        const stateDescriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(history), "state");
        Object.defineProperty(history, "state", {
            ...stateDescriptor,
            get() {
                // Derive history state only ever directly from navigation state
                //
                // Decouple from classic history.state
                //
                // If the original state is wanted, use history.originalState,
                // which is done on a best effort basis and may be out of alignment from
                // navigation.currentEntry.getState()
                //
                // This state will always be tied to the navigation, not the background
                // browser's history stack, which could be offset from the applications
                // expected state between moments of transition.
                //
                // The change of using navigation.currentEntry.getState()
                // in place of history.state is significant, it's shifting to a model where
                // there can be an entry only for one single operation and then replaced
                //
                // e.g.
                //
                // navigation.navigate("/1", { state: { key: 1 }});
                // navigation.navigate("/2", { state: { key: 2 }});
                // await navigation.transition?.finished;
                //
                // The above code, if ran, history.state might not keep up...
                //
                // ... In safari if we run replaceState too many times in 30 seconds
                // then we will get an exception. So, inherently we know we
                // cannot just freely make use of history.state as a deterministic like
                // reference.
                return polyfillHistory.state;
            }
        });
        Object.defineProperty(history, "originalState", {
            ...stateDescriptor
        });
    }
    function patchPopState() {
        if (!window.PopStateEvent)
            return;
        const popStateEventPrototype = window.PopStateEvent.prototype;
        if (!popStateEventPrototype)
            return;
        const descriptor = Object.getOwnPropertyDescriptor(popStateEventPrototype, "state");
        Object.defineProperty(popStateEventPrototype, "state", {
            ...descriptor,
            get() {
                const original = descriptor.get.call(this);
                if (!isStateHistoryWithMeta(original))
                    return original;
                return original[NavigationKey].state;
            }
        });
        Object.defineProperty(popStateEventPrototype, "originalState", {
            ...descriptor
        });
    }
}
function getCompletePolyfill(options = DEFAULT_POLYFILL_OPTIONS) {
    const { persist: PERSIST_ENTRIES, persistState: PERSIST_ENTRIES_STATE, history: givenHistory, limit: patchLimit, patch: PATCH_HISTORY, interceptEvents: INTERCEPT_EVENTS, window: givenWindow = globalWindow, navigation: givenNavigation } = {
        // These are super default options, if the object de
        ...DEFAULT_POLYFILL_OPTIONS,
        ...options
    };
    // console.log({
    //   ...DEFAULT_POLYFILL_OPTIONS,
    //   ...options
    // })
    const IS_PERSIST = PERSIST_ENTRIES || PERSIST_ENTRIES_STATE;
    const window = givenWindow ?? globalWindow;
    const history = options.history && typeof options.history !== "boolean" ?
        options.history :
        getWindowHistory(window);
    if (!history) {
        return getNavigationOnlyPolyfill();
    }
    // console.log("POLYFILL LOADING");
    ok(window, "window required when using polyfill with history, this shouldn't be seen");
    // Use baseHistory so that we don't initialise entries we didn't intend to
    // if we used a polyfill history
    const historyInitialState = history?.state;
    let initialMeta = {
        [NavigationMeta]: true,
        currentIndex: -1,
        entries: [],
        key: "",
        state: undefined
    };
    if (isStateHistoryWithMeta(historyInitialState)) {
        initialMeta = historyInitialState[NavigationKey];
    }
    let initialEntries = initialMeta.entries;
    const HISTORY_INTEGRATION = !!((givenWindow || givenHistory) && history);
    if (!initialEntries.length) {
        let url = undefined;
        if (window.location?.href) {
            url = window.location.href;
        }
        let state = undefined;
        if (!isStateHistoryWithMeta(historyInitialState) && !isStateHistoryMeta(historyInitialState)) {
            // console.log("Using state history direct", historyInitialState, history.state);
            state = historyInitialState;
        }
        const key = v4$2();
        initialEntries = [
            {
                key,
                state,
                url
            }
        ];
        initialMeta.key = key;
        initialMeta.currentIndex = 0;
    }
    // console.log("Initial Entries", initialEntries)
    const navigationOptions = {
        entries: initialEntries,
        currentIndex: initialMeta?.currentIndex,
        currentKey: initialMeta?.key,
        getState(entry) {
            if (!HISTORY_INTEGRATION)
                return;
            return getHistoryState(history, entry);
        },
        setState(entry) {
            // console.log({
            //   setState: entry.getState(),
            //   entry
            // })
            if (!HISTORY_INTEGRATION)
                return;
            if (!entry.sameDocument)
                return;
            setHistoryState(navigation, history, entry, IS_PERSIST, patchLimit);
        },
        disposeState(entry) {
            if (!HISTORY_INTEGRATION)
                return;
            disposeHistoryState(entry, IS_PERSIST);
        }
    };
    const navigation = givenNavigation ?? new Navigation(navigationOptions);
    const pushState = history?.pushState.bind(history);
    const replaceState = history?.replaceState.bind(history);
    const historyGo = history?.go.bind(history);
    // const back = history?.back.bind(history);
    // const forward = history?.forward.bind(history);
    // const origin = typeof location === "undefined" ? "https://example.com" : location.origin;
    return {
        navigation,
        history,
        apply() {
            // console.log("APPLYING POLYFILL TO NAVIGATION");
            if (isNavigationPolyfill(navigation)) {
                // Initialise navigation options
                navigation[NavigationSetOptions](navigationOptions);
            }
            if (HISTORY_INTEGRATION) {
                const ignorePopState = new Set();
                const ignoreCurrentEntryChange = new Set();
                navigation.addEventListener("navigate", event => {
                    if (event.destination.sameDocument) {
                        return;
                    }
                    // If the destination is not the same document, we are navigating away
                    event.intercept({
                        // Set commit after transition... and never commit!
                        commit: "after-transition",
                        async handler() {
                            // Let other tasks do something and abort if needed
                            queueMicrotask(() => {
                                if (event.signal.aborted)
                                    return;
                                submit();
                            });
                        }
                    });
                    function submit() {
                        if (like(event.originalEvent)) {
                            const anchor = getAnchorFromEvent(event.originalEvent);
                            if (anchor) {
                                return submitAnchor(anchor);
                            }
                            else {
                                const form = getFormFromEvent(event.originalEvent);
                                if (form) {
                                    return submitForm(form);
                                }
                            }
                        }
                        // Assumption that navigation event means to navigate...
                        location.href = event.destination.url;
                    }
                    function submitAnchor(element) {
                        const cloned = element.cloneNode();
                        cloned.setAttribute("data-navigation-ignore", "1");
                        cloned.click();
                    }
                    function submitForm(element) {
                        const cloned = element.cloneNode();
                        cloned.setAttribute("data-navigation-ignore", "1");
                        cloned.submit();
                    }
                });
                navigation.addEventListener("currententrychange", ({ navigationType, from }) => {
                    // console.log("<-- currententrychange event listener -->");
                    const { currentEntry } = navigation;
                    if (!currentEntry)
                        return;
                    const { key, url } = currentEntry;
                    if (ignoreCurrentEntryChange.delete(key) || !currentEntry?.sameDocument)
                        return;
                    const historyState = getNavigationEntryWithMeta(navigation, currentEntry, patchLimit);
                    // console.log("currentEntry change", historyState);
                    switch (navigationType || "replace") {
                        case "push":
                            return pushState(historyState, "", url);
                        case "replace":
                            return replaceState(historyState, "", url);
                        case "traverse":
                            const delta = currentEntry.index - from.index;
                            ignorePopState.add(key);
                            return historyGo(delta);
                        // TODO
                    }
                });
                window.addEventListener("popstate", (event) => {
                    // console.log("<-- popstate event listener -->");
                    const { state, originalState } = event;
                    const foundState = originalState ?? state;
                    if (!isStateHistoryWithMeta(foundState))
                        return;
                    const { [NavigationKey]: { key } } = foundState;
                    if (ignorePopState.delete(key))
                        return;
                    ignoreCurrentEntryChange.add(key);
                    let committed;
                    try {
                        committed = navigation.traverseTo(key).committed;
                    }
                    catch (error) {
                        if (error instanceof InvalidStateError && !PERSIST_ENTRIES) {
                            // ignore the error
                            return;
                        }
                        throw error;
                    }
                    if (PERSIST_ENTRIES || PERSIST_ENTRIES_STATE) {
                        committed
                            .then(entry => {
                            const historyState = getNavigationEntryWithMeta(navigation, entry, patchLimit);
                            replaceState(historyState, "", entry.url);
                        })
                            // Noop catch
                            .catch(() => { });
                    }
                });
                // window.addEventListener("hashchange", (ev) => {
                //   // TODO
                // })
            }
            if (INTERCEPT_EVENTS) {
                interceptWindowClicks(navigation, window);
            }
            if (PATCH_HISTORY) {
                patchGlobalScope(window, history, navigation);
            }
            if (!history.state) {
                // Initialise history state if not available
                const historyState = getNavigationEntryWithMeta(navigation, navigation.currentEntry, patchLimit);
                replaceState(historyState, "", navigation.currentEntry.url);
            }
        }
    };
}
function isAppNavigation(evt) {
    return evt.button === 0 &&
        !evt.defaultPrevented &&
        !evt.metaKey &&
        !evt.altKey &&
        !evt.ctrlKey &&
        !evt.shiftKey;
}
/** Checks if this element or any of its parents matches a given `selector` */
function matchesAncestor(givenElement, selector) {
    let element = getDefaultElement();
    // console.log({ element })
    while (element) {
        if (element.matches(selector)) {
            ok(element);
            return element;
        }
        element = element.parentElement;
    }
    return undefined;
    function getDefaultElement() {
        if (!givenElement)
            return undefined;
        if (givenElement.matches instanceof Function)
            return givenElement;
        return givenElement.parentElement;
    }
}

function applyPolyfill(options = DEFAULT_POLYFILL_OPTIONS) {
    const { apply, navigation } = getCompletePolyfill(options);
    apply();
    return navigation;
}

const GlobalUUID = isRandomUUID(crypto)
    ? ((crypto) => () => crypto.randomUUID())(crypto)
    : undefined;
function isRandomUUID(value) {
    function isLike(value) {
        return typeof value !== "undefined";
    }
    return isLike(value) && typeof value.randomUUID === "function";
}

// import UUID from "uuid";
// async function importUUID() {
//     const { v4 } = await import("uuid");
//     return v4;
// }
const v4$1 = GlobalUUID; //await importUUID();

var importUuid = /*#__PURE__*/Object.freeze({
    __proto__: null,
    v4: v4$1
});

// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).
var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  // lazy load so that environments that need to polyfill have a chance to do so
  if (!getRandomValues) {
    // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation. Also,
    // find the complete implementation of crypto (msCrypto) on IE11.
    getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== 'undefined' && typeof msCrypto.getRandomValues === 'function' && msCrypto.getRandomValues.bind(msCrypto);

    if (!getRandomValues) {
      throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
    }
  }

  return getRandomValues(rnds8);
}

var REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

function validate(uuid) {
  return typeof uuid === 'string' && REGEX.test(uuid);
}

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */

var byteToHex = [];

for (var i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).substr(1));
}

function stringify$1(arr) {
  var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  var uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase(); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!validate(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

var _nodeId;

var _clockseq; // Previous uuid creation time


var _lastMSecs = 0;
var _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details

function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || new Array(16);
  options = options || {};
  var node = options.node || _nodeId;
  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189

  if (node == null || clockseq == null) {
    var seedBytes = options.random || (options.rng || rng)();

    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }

    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  } // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.


  var msecs = options.msecs !== undefined ? options.msecs : Date.now(); // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock

  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)

  var dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression

  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval


  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  } // Per 4.2.1.2 Throw error if too many uuids are requested


  if (nsecs >= 10000) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch

  msecs += 12219292800000; // `time_low`

  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff; // `time_mid`

  var tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff; // `time_high_and_version`

  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version

  b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)

  b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`

  b[i++] = clockseq & 0xff; // `node`

  for (var n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf || stringify$1(b);
}

function parse$1(uuid) {
  if (!validate(uuid)) {
    throw TypeError('Invalid UUID');
  }

  var v;
  var arr = new Uint8Array(16); // Parse ########-....-....-....-............

  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 0xff;
  arr[2] = v >>> 8 & 0xff;
  arr[3] = v & 0xff; // Parse ........-####-....-....-............

  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff; // Parse ........-....-####-....-............

  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff; // Parse ........-....-....-####-............

  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff; // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
  arr[11] = v / 0x100000000 & 0xff;
  arr[12] = v >>> 24 & 0xff;
  arr[13] = v >>> 16 & 0xff;
  arr[14] = v >>> 8 & 0xff;
  arr[15] = v & 0xff;
  return arr;
}

function stringToBytes(str) {
  str = unescape(encodeURIComponent(str)); // UTF8 escape

  var bytes = [];

  for (var i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }

  return bytes;
}

var DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
var URL$1 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
function v35 (name, version, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    if (typeof value === 'string') {
      value = stringToBytes(value);
    }

    if (typeof namespace === 'string') {
      namespace = parse$1(namespace);
    }

    if (namespace.length !== 16) {
      throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    } // Compute hash of namespace and value, Per 4.3
    // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
    // hashfunc([...namespace, ... value])`


    var bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 0x0f | version;
    bytes[8] = bytes[8] & 0x3f | 0x80;

    if (buf) {
      offset = offset || 0;

      for (var i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }

      return buf;
    }

    return stringify$1(bytes);
  } // Function#name is not settable on some platforms (#270)


  try {
    generateUUID.name = name; // eslint-disable-next-line no-empty
  } catch (err) {} // For CommonJS default export support


  generateUUID.DNS = DNS;
  generateUUID.URL = URL$1;
  return generateUUID;
}

/*
 * Browser-compatible JavaScript MD5
 *
 * Modification of JavaScript MD5
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 *
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
function md5(bytes) {
  if (typeof bytes === 'string') {
    var msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = new Uint8Array(msg.length);

    for (var i = 0; i < msg.length; ++i) {
      bytes[i] = msg.charCodeAt(i);
    }
  }

  return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
}
/*
 * Convert an array of little-endian words to an array of bytes
 */


function md5ToHexEncodedArray(input) {
  var output = [];
  var length32 = input.length * 32;
  var hexTab = '0123456789abcdef';

  for (var i = 0; i < length32; i += 8) {
    var x = input[i >> 5] >>> i % 32 & 0xff;
    var hex = parseInt(hexTab.charAt(x >>> 4 & 0x0f) + hexTab.charAt(x & 0x0f), 16);
    output.push(hex);
  }

  return output;
}
/**
 * Calculate output length with padding and bit length
 */


function getOutputLength(inputLength8) {
  return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
}
/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */


function wordsToMd5(x, len) {
  /* append padding */
  x[len >> 5] |= 0x80 << len % 32;
  x[getOutputLength(len) - 1] = len;
  var a = 1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d = 271733878;

  for (var i = 0; i < x.length; i += 16) {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    a = md5ff(a, b, c, d, x[i], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = md5ii(a, b, c, d, x[i], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  return [a, b, c, d];
}
/*
 * Convert an array bytes to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */


function bytesToWords(input) {
  if (input.length === 0) {
    return [];
  }

  var length8 = input.length * 8;
  var output = new Uint32Array(getOutputLength(length8));

  for (var i = 0; i < length8; i += 8) {
    output[i >> 5] |= (input[i / 8] & 0xff) << i % 32;
  }

  return output;
}
/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */


function safeAdd(x, y) {
  var lsw = (x & 0xffff) + (y & 0xffff);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return msw << 16 | lsw & 0xffff;
}
/*
 * Bitwise rotate a 32-bit number to the left.
 */


function bitRotateLeft(num, cnt) {
  return num << cnt | num >>> 32 - cnt;
}
/*
 * These functions implement the four basic operations the algorithm uses.
 */


function md5cmn(q, a, b, x, s, t) {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5ff(a, b, c, d, x, s, t) {
  return md5cmn(b & c | ~b & d, a, b, x, s, t);
}

function md5gg(a, b, c, d, x, s, t) {
  return md5cmn(b & d | c & ~d, a, b, x, s, t);
}

function md5hh(a, b, c, d, x, s, t) {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}

function md5ii(a, b, c, d, x, s, t) {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}

var v3 = v35('v3', 0x30, md5);
var v3$1 = v3;

function v4(options, buf, offset) {
  options = options || {};
  var rnds = options.random || (options.rng || rng)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  if (buf) {
    offset = offset || 0;

    for (var i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }

    return buf;
  }

  return stringify$1(rnds);
}

// Adapted from Chris Veness' SHA1 code at
// http://www.movable-type.co.uk/scripts/sha1.html
function f(s, x, y, z) {
  switch (s) {
    case 0:
      return x & y ^ ~x & z;

    case 1:
      return x ^ y ^ z;

    case 2:
      return x & y ^ x & z ^ y & z;

    case 3:
      return x ^ y ^ z;
  }
}

function ROTL(x, n) {
  return x << n | x >>> 32 - n;
}

function sha1(bytes) {
  var K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
  var H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  if (typeof bytes === 'string') {
    var msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = [];

    for (var i = 0; i < msg.length; ++i) {
      bytes.push(msg.charCodeAt(i));
    }
  } else if (!Array.isArray(bytes)) {
    // Convert Array-like to Array
    bytes = Array.prototype.slice.call(bytes);
  }

  bytes.push(0x80);
  var l = bytes.length / 4 + 2;
  var N = Math.ceil(l / 16);
  var M = new Array(N);

  for (var _i = 0; _i < N; ++_i) {
    var arr = new Uint32Array(16);

    for (var j = 0; j < 16; ++j) {
      arr[j] = bytes[_i * 64 + j * 4] << 24 | bytes[_i * 64 + j * 4 + 1] << 16 | bytes[_i * 64 + j * 4 + 2] << 8 | bytes[_i * 64 + j * 4 + 3];
    }

    M[_i] = arr;
  }

  M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
  M[N - 1][14] = Math.floor(M[N - 1][14]);
  M[N - 1][15] = (bytes.length - 1) * 8 & 0xffffffff;

  for (var _i2 = 0; _i2 < N; ++_i2) {
    var W = new Uint32Array(80);

    for (var t = 0; t < 16; ++t) {
      W[t] = M[_i2][t];
    }

    for (var _t = 16; _t < 80; ++_t) {
      W[_t] = ROTL(W[_t - 3] ^ W[_t - 8] ^ W[_t - 14] ^ W[_t - 16], 1);
    }

    var a = H[0];
    var b = H[1];
    var c = H[2];
    var d = H[3];
    var e = H[4];

    for (var _t2 = 0; _t2 < 80; ++_t2) {
      var s = Math.floor(_t2 / 20);
      var T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[_t2] >>> 0;
      e = d;
      d = c;
      c = ROTL(b, 30) >>> 0;
      b = a;
      a = T;
    }

    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
  }

  return [H[0] >> 24 & 0xff, H[0] >> 16 & 0xff, H[0] >> 8 & 0xff, H[0] & 0xff, H[1] >> 24 & 0xff, H[1] >> 16 & 0xff, H[1] >> 8 & 0xff, H[1] & 0xff, H[2] >> 24 & 0xff, H[2] >> 16 & 0xff, H[2] >> 8 & 0xff, H[2] & 0xff, H[3] >> 24 & 0xff, H[3] >> 16 & 0xff, H[3] >> 8 & 0xff, H[3] & 0xff, H[4] >> 24 & 0xff, H[4] >> 16 & 0xff, H[4] >> 8 & 0xff, H[4] & 0xff];
}

var v5 = v35('v5', 0x50, sha1);
var v5$1 = v5;

var nil = '00000000-0000-0000-0000-000000000000';

function version(uuid) {
  if (!validate(uuid)) {
    throw TypeError('Invalid UUID');
  }

  return parseInt(uuid.substr(14, 1), 16);
}

var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    v1: v1,
    v3: v3$1,
    v4: v4,
    v5: v5$1,
    NIL: nil,
    version: version,
    validate: validate,
    stringify: stringify$1,
    parse: parse$1
});

const VOID       = -1;
const PRIMITIVE  = 0;
const ARRAY      = 1;
const OBJECT     = 2;
const DATE       = 3;
const REGEXP     = 4;
const MAP        = 5;
const SET        = 6;
const ERROR      = 7;
const BIGINT     = 8;
// export const SYMBOL = 9;

const env = typeof self === 'object' ? self : globalThis;

const deserializer = ($, _) => {
  const as = (out, index) => {
    $.set(index, out);
    return out;
  };

  const unpair = index => {
    if ($.has(index))
      return $.get(index);

    const [type, value] = _[index];
    switch (type) {
      case PRIMITIVE:
      case VOID:
        return as(value, index);
      case ARRAY: {
        const arr = as([], index);
        for (const index of value)
          arr.push(unpair(index));
        return arr;
      }
      case OBJECT: {
        const object = as({}, index);
        for (const [key, index] of value)
          object[unpair(key)] = unpair(index);
        return object;
      }
      case DATE:
        return as(new Date(value), index);
      case REGEXP: {
        const {source, flags} = value;
        return as(new RegExp(source, flags), index);
      }
      case MAP: {
        const map = as(new Map, index);
        for (const [key, index] of value)
          map.set(unpair(key), unpair(index));
        return map;
      }
      case SET: {
        const set = as(new Set, index);
        for (const index of value)
          set.add(unpair(index));
        return set;
      }
      case ERROR: {
        const {name, message} = value;
        return as(new env[name](message), index);
      }
      case BIGINT:
        return as(BigInt(value), index);
      case 'BigInt':
        return as(Object(BigInt(value)), index);
    }
    return as(new env[type](value), index);
  };

  return unpair;
};

/**
 * @typedef {Array<string,any>} Record a type representation
 */

/**
 * Returns a deserialized value from a serialized array of Records.
 * @param {Record[]} serialized a previously serialized value.
 * @returns {any}
 */
const deserialize = serialized => deserializer(new Map, serialized)(0);

const EMPTY = '';

const {toString} = {};
const {keys} = Object;

const typeOf = value => {
  const type = typeof value;
  if (type !== 'object' || !value)
    return [PRIMITIVE, type];

  const asString = toString.call(value).slice(8, -1);
  switch (asString) {
    case 'Array':
      return [ARRAY, EMPTY];
    case 'Object':
      return [OBJECT, EMPTY];
    case 'Date':
      return [DATE, EMPTY];
    case 'RegExp':
      return [REGEXP, EMPTY];
    case 'Map':
      return [MAP, EMPTY];
    case 'Set':
      return [SET, EMPTY];
  }

  if (asString.includes('Array'))
    return [ARRAY, asString];

  if (asString.includes('Error'))
    return [ERROR, asString];

  return [OBJECT, asString];
};

const shouldSkip = ([TYPE, type]) => (
  TYPE === PRIMITIVE &&
  (type === 'function' || type === 'symbol')
);

const serializer = (strict, json, $, _) => {

  const as = (out, value) => {
    const index = _.push(out) - 1;
    $.set(value, index);
    return index;
  };

  const pair = value => {
    if ($.has(value))
      return $.get(value);

    let [TYPE, type] = typeOf(value);
    switch (TYPE) {
      case PRIMITIVE: {
        let entry = value;
        switch (type) {
          case 'bigint':
            TYPE = BIGINT;
            entry = value.toString();
            break;
          case 'function':
          case 'symbol':
            if (strict)
              throw new TypeError('unable to serialize ' + type);
            entry = null;
            break;
          case 'undefined':
            return as([VOID], value);
        }
        return as([TYPE, entry], value);
      }
      case ARRAY: {
        if (type)
          return as([type, [...value]], value);
  
        const arr = [];
        const index = as([TYPE, arr], value);
        for (const entry of value)
          arr.push(pair(entry));
        return index;
      }
      case OBJECT: {
        if (type) {
          switch (type) {
            case 'BigInt':
              return as([type, value.toString()], value);
            case 'Boolean':
            case 'Number':
            case 'String':
              return as([type, value.valueOf()], value);
          }
        }

        if (json && ('toJSON' in value))
          return pair(value.toJSON());

        const entries = [];
        const index = as([TYPE, entries], value);
        for (const key of keys(value)) {
          if (strict || !shouldSkip(typeOf(value[key])))
            entries.push([pair(key), pair(value[key])]);
        }
        return index;
      }
      case DATE:
        return as([TYPE, value.toISOString()], value);
      case REGEXP: {
        const {source, flags} = value;
        return as([TYPE, {source, flags}], value);
      }
      case MAP: {
        const entries = [];
        const index = as([TYPE, entries], value);
        for (const [key, entry] of value) {
          if (strict || !(shouldSkip(typeOf(key)) || shouldSkip(typeOf(entry))))
            entries.push([pair(key), pair(entry)]);
        }
        return index;
      }
      case SET: {
        const entries = [];
        const index = as([TYPE, entries], value);
        for (const entry of value) {
          if (strict || !shouldSkip(typeOf(entry)))
            entries.push(pair(entry));
        }
        return index;
      }
    }

    const {message} = value;
    return as([TYPE, {name: type, message}], value);
  };

  return pair;
};

/**
 * @typedef {Array<string,any>} Record a type representation
 */

/**
 * Returns an array of serialized Records.
 * @param {any} value a serializable value.
 * @param {{lossy?: boolean}?} options an object with a `lossy` property that,
 *  if `true`, will not throw errors on incompatible types, and behave more
 *  like JSON stringify would behave. Symbol and Function will be discarded.
 * @returns {Record[]}
 */
 const serialize = (value, {json, lossy} = {}) => {
  const _ = [];
  return serializer(!(json || lossy), !!json, new Map, _)(value), _;
};

/*! (c) Andrea Giammarchi - ISC */

const {parse: $parse, stringify: $stringify} = JSON;
const options = {json: true, lossy: true};

/**
 * Revive a previously stringified structured clone.
 * @param {string} str previously stringified data as string.
 * @returns {any} whatever was previously stringified as clone.
 */
const parse = str => deserialize($parse(str));

/**
 * Represent a structured clone value as string.
 * @param {any} any some clone-able value to stringify.
 * @returns {string} the value stringified.
 */
const stringify = any => $stringify(serialize(any, options));

var json = /*#__PURE__*/Object.freeze({
    __proto__: null,
    parse: parse,
    stringify: stringify
});

export { AppLocationAwaitFinished, AppLocationCheckChange, AppLocationTransitionURL, AppLocationUrl, EventTarget, NAVIGATION_LOCATION_DEFAULT_URL, Navigation, NavigationCanIntercept, NavigationCurrentEntryChangeEvent, NavigationDisposeState, NavigationFormData, NavigationGetState, NavigationHistory, NavigationLocation, NavigationSetCurrentIndex, NavigationSetCurrentKey, NavigationSetEntries, NavigationSetOptions, NavigationSetState, NavigationSync, NavigationTransitionFinally, NavigationUserInitiated, applyPolyfill, getCompletePolyfill, getPolyfill, isInterceptEvent, isNavigationNavigationType, transition };
//# sourceMappingURL=rollup.js.map
