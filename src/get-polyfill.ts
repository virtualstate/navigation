import type {Navigation, NavigationHistoryEntry} from "./spec/navigation";
import {
  Navigation as NavigationPolyfill,
  NavigationOptions,
  NavigationSetCurrentKey,
  NavigationSetEntries, NavigationSetOptions
} from "./navigation";
import { InvalidStateError } from "./navigation-errors";
import { InternalNavigationNavigateOptions, NavigationDownloadRequest, NavigationFormData, NavigationOriginalEvent, NavigationUserInitiated } from "./create-navigation-transition";
import { stringify, parse } from './util/structured-json';
import {NavigationHistory} from "./history";
import {like, ok} from "./is";
import {
  ElementPrototype, EventPrototype,
  globalWindow,
  HTMLAnchorElementPrototype,
  HTMLFormElementPrototype,
  MouseEventPrototype, SubmitEventPrototype,
  WindowLike
} from "./global-window";
import {globalSelf} from "./global-self";
import {v4} from "./util/uuid-or-random";
import {NavigationHistoryEntrySerialized} from "./navigation-entry";

export interface NavigationPolyfillOptions {
  /**
   * Integrate polyfilled Navigation API with legacy History API.
   * Specifically, `popstate` will trigger navigation traversal and
   * navigates will push state on History API.
   * This enables forward/backward to work in most cases, but not after page refresh, etc.
   * See {@link NavigationPolyfillOptions.persist} on how to recover from hard resets.
   *
   * __WIP__: No consideration given to iframes and other edge cases.
   * `hashchange` not implemented (but might work anyway for most cases with {@link INTERCEPT_EVENTS}?).
   * `scroll` not implemented.
   */
  history?: boolean | NavigationHistory<object>;


  /**
   * Persists all navigation entries in history state.
   * This enables forward/backward to work after hard refresh, closing/reopening tab, etc.
   * but comes at the cost of storing all navigation history entries _on every history frame_.
   * This isn't quite as crazy as it seems, as each entry only consists of `url`, `key` and `id`,
   * but you might want to disable it regardless.
   *
   * __WIP__: Maybe store entries in session storage instead and only keep an id in history state?
   * What's worse, sync access + stringification or duplication on history state? 🤔
   */
  persist?: boolean;

  /** Limits max # of entries stored in history storage */
  limit?: number;

  /**
   * Like {@link NavigationPolyfillOptions.limit}, except also stores the state for each navigation entry.
   * Note that you might not need this if you only need the state of the current navigation entry,
   * which works with {@link NavigationPolyfillOptions.history} alone.
   * Enabling this allows retrieving the state of *any navigation entry even after a hard refresh*.
   *
   * __WIP__: State is stringified and stored in `sessionStorage`. This works for small objects,
   * but gets awkward when storing large array buffers, etc.
   * A more advanced implementation could combine session storage with a
   * [Storage Area](https://workers.tools/kv-storage-polyfill) (Indexed DB) for better perf...
   * __NOTE__: Turns out session storage is easier lost than history state (in webkit at least)
   * It will survive hard refresh (but not always?) but not closing tab and restoring it.
   */
  persistState?: boolean;

  /**
   * Monkey patches History API methods to call new Navigation API methods instead.
   * Could solve issues when combining Navigation API with frameworks that use the legacy History API,
   * or it might cause additional issues instead 🤷‍♂️.
   *
   * __NOTE__: This performs some prototype acrobatics to hide the "real" history state from the application.
   * If this sounds scary you might want to disable this.
   */
  patch?: boolean;

  /**
   * Intercepts clicks on `a` tags and `form` submissions and conditionally calls `preventDefault` based on
   * application code response to the `navigate` event. This is the final piece of the Navigation API puzzle,
   * as it allows using vanilla HTML elements instead of framework specific components like `<Link/>` or `<A/>`.
   * In practice you might want to use those anyway, in which case you wouldn't need to enable this setting.
   */
  interceptEvents?: boolean;

  window?: WindowLike;

  navigation?: Navigation
}

export const NavigationKey = "__@virtualstate/navigation/key";
export const NavigationMeta = "__@virtualstate/navigation/meta";


declare var FormData: {
  new(element: HTMLFormElementPrototype): FormData
}



function getWindowHistory(givenWindow: WindowLike | undefined = globalWindow) {
  if (typeof givenWindow === "undefined") return undefined;
  return givenWindow.history;
}

function getStateFromWindowHistory<T extends object = Record<string | symbol, unknown>>(givenWindow: WindowLike | undefined = globalWindow): T | undefined {
  const history = getWindowHistory(givenWindow);
  if (!history) return undefined;
  const value = history.state;
  return like<T>(value) ? value : undefined;
}

interface StateHistoryMeta<T = unknown> {
  [NavigationMeta]: true;
  key: string;
  currentIndex: number;
  entries: NavigationHistoryEntrySerialized[];
  state: T;
}

interface StateHistoryWithMeta<T = unknown> {
  [NavigationKey]: StateHistoryMeta<T>
}

function isStateHistoryMeta<T>(state: T): state is T & StateHistoryWithMeta<T> {
  return like<StateHistoryMeta<T>>(state) && state[NavigationMeta] === true;
}

function isStateHistoryWithMeta<T>(state: T): state is T & StateHistoryWithMeta<T> {
  return like<StateHistoryWithMeta<T>>(state) && isStateHistoryMeta(state[NavigationKey]);
}

function disposeHistoryState<T extends object>(
    entry: NavigationHistoryEntry<T>,
    persist: boolean
) {
  if (!persist) return;
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(entry.key)
}

function getEntries(navigation: Navigation, limit: number = DEFAULT_POLYFILL_OPTIONS.limit): NavigationHistoryEntrySerialized[] {
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

function getNavigationEntryMeta<T>(navigation: Navigation<T>, entry: NavigationHistoryEntry<T>, limit = DEFAULT_POLYFILL_OPTIONS.limit): StateHistoryMeta<T> {
  return {
    [NavigationMeta]: true,
    currentIndex: entry.index,
    key: entry.key,
    entries: getEntries(navigation, limit),
    state: entry.getState()
  }
}

function getNavigationEntryWithMeta<T>(navigation: Navigation<T>, entry: NavigationHistoryEntry<T>, limit = DEFAULT_POLYFILL_OPTIONS.limit): StateHistoryWithMeta<T> {
  return {
    [NavigationKey]: getNavigationEntryMeta(navigation, entry, limit)
  }
}

function setHistoryState<T extends object>(
    navigation: Navigation<T>,
    history: NavigationHistory<T>,
    entry: NavigationHistoryEntry<T>,
    persist: boolean,
    limit: number | undefined
) {
  setStateInSession()

  function getSerializableState(): StateHistoryWithMeta<T> {
    return getNavigationEntryWithMeta(navigation, entry, limit);
  }

  function setStateInSession() {
    if (typeof sessionStorage === "undefined") return;
    try {
      const raw = stringify(
          getSerializableState()
      );
      sessionStorage.setItem(entry.key, raw);
    } catch {}
  }
}

function getHistoryState<T extends object>(
    history: NavigationHistory<T> & { originalState?: T },
    entry: NavigationHistoryEntry<T>
): T {
  return (
      getStateFromHistoryIfMatchingKey() ??
      getStateFromSession()
  );

  function getStateFromHistoryDirectly() {
    try {
      return history.state;
    } catch {
      return undefined;
    }
  }

  function getBaseState() {
    const value = (
        history.originalState ??
        getStateFromHistoryDirectly()
    );
    return like<T>(value) ? value : undefined;
  }

  function getStateFromHistoryIfMatchingKey() {
    const state = getBaseState();
    if (!isStateHistoryWithMeta(state)) return undefined;
    if (state[NavigationKey].key !== entry.key) return undefined;
    return state[NavigationKey].state;
  }

  function getStateFromSession(): T | undefined {
    if (typeof sessionStorage === "undefined") return undefined;
    try {
      const raw = sessionStorage.getItem(entry.key);
      if (!raw) return undefined;
      const state = parse(raw);
      if (!isStateHistoryWithMeta(state)) return undefined;
      return state[NavigationKey].state;
    } catch {
      return undefined;
    }
  }
}

export const DEFAULT_POLYFILL_OPTIONS: NavigationPolyfillOptions = Object.freeze({
  persist: true,
  persistState: true,
  history: true,
  limit: 50,
  patch: true,
  interceptEvents: true
});

export function getPolyfill(options: NavigationPolyfillOptions = DEFAULT_POLYFILL_OPTIONS): Navigation {
  const { navigation } = getCompletePolyfill(options);
  return navigation;
}

function isNavigationPolyfill(navigation?: Navigation): navigation is NavigationPolyfill {
  return (
      like<NavigationPolyfill>(navigation) &&
      typeof navigation[NavigationSetEntries] === "function" &&
      typeof navigation[NavigationSetCurrentKey] === "function"
  )
}

function getNavigationOnlyPolyfill(givenNavigation?: Navigation) {
  // When using as a polyfill, we will auto initiate a single
  // entry, but not cause an event for it
  const entries = [
    {
      key: v4()
    }
  ];
  const navigation = givenNavigation ?? new NavigationPolyfill({
    entries
  });
  const history = new NavigationHistory<object>({
    navigation
  })
  return {
    navigation,
    history,
    apply() {
      if (isNavigationPolyfill(givenNavigation) && !navigation.entries().length) {
        givenNavigation[NavigationSetEntries](entries)
      }
    }
  }
}

function interceptWindowClicks(navigation: Navigation, window: WindowLike) {
  function clickCallback(ev: MouseEventPrototype, aEl: HTMLAnchorElementPrototype) {
    // console.log("<-- clickCallback -->");
    // TODO opt into queueMicrotask before process
    process();

    function process() {
      if (!isAppNavigation(ev)) return;
      ok<Event>(ev);
      const options: InternalNavigationNavigateOptions = {
        history: "auto",
        [NavigationUserInitiated]: true,
        [NavigationDownloadRequest]: aEl.download,
        [NavigationOriginalEvent]: ev,
      };
      navigation.navigate(aEl.href, options);
    }
  }
  function submitCallback(ev: SubmitEventPrototype, form: HTMLFormElementPrototype) {
    // console.log("<-- submitCallback -->");
    // TODO opt into queueMicrotask before process
    process();

    function process() {
      if (ev.defaultPrevented) return;
      const method = ev.submitter && 'formMethod' in ev.submitter && ev.submitter.formMethod
          ? ev.submitter.formMethod as string
          : form.method;
      // XXX: safe to ignore dialog method?
      if (method === 'dialog') return;
      const action = ev.submitter && 'formAction' in ev.submitter && ev.submitter.formAction
          ? ev.submitter.formAction as string
          : form.action;
      let formData;
      /* c8 ignore start */
      try {
        formData = new FormData(form)
      } catch {
        // For runtimes where we polyfilled the window & then evented it
        // ... for some reason
        formData = new FormData(undefined)
      }
      /* c8 ignore end */
      const params = method === 'get'
          ? new URLSearchParams([...formData].map(([k, v]) => v instanceof File ? [k, v.name] : [k, v]))
          : undefined;
      const navFormData = method === 'post'
          ? formData
          : undefined;
      // action is always a fully qualified url in browsers
      const url = new URL(
          action,
          navigation.currentEntry.url
      );
      if (params)
        url.search = params.toString();
      const unknownEvent = ev;
      ok<Event>(unknownEvent);
      const options: InternalNavigationNavigateOptions = {
        history: "auto",
        [NavigationUserInitiated]: true,
        [NavigationFormData]: navFormData,
        [NavigationOriginalEvent]: unknownEvent,
      };
      navigation.navigate(url.href, options);
    }
  }
  // console.log("click event added")
  window.addEventListener("click", (ev: MouseEventPrototype) => {
    // console.log("click event", ev)
    if (ev.target?.ownerDocument === window.document) {
      const aEl = matchesAncestor(getComposedPathTarget(ev), "a[href]"); // XXX: not sure what <a> tags without href do
      if (like<HTMLAnchorElementPrototype>(aEl)) {
        clickCallback(ev, aEl);
      }
    }
  });
  window.addEventListener("submit", (ev: SubmitEventPrototype) => {
    // console.log("submit event")
    if (ev.target?.ownerDocument === window.document) {
      const form: unknown = matchesAncestor(getComposedPathTarget(ev), "form");
      if (like<HTMLFormElementPrototype>(form)) {
        submitCallback(ev, form);
      }
    }
  });
}

function getComposedPathTarget(event: EventPrototype) {
  if (!event.composedPath) {
    return event.target;
  }
  const targets = event.composedPath();
  return targets[0] ?? event.target;
}

function patchGlobalScope(window: WindowLike, history: NavigationHistory<object>, navigation: Navigation) {
  patchGlobals();
  patchPopState();
  patchHistory();

  function patchWindow(window: WindowLike) {
    try {
      Object.defineProperty(window, "navigation", {
        value: navigation,
      });
    } catch (e) {}
    if (!window.history) {
      try {
        Object.defineProperty(window, "history", {
          value: history,
        });
      } catch (e) {}
    }
  }

  function patchGlobals() {
    patchWindow(window);
    // If we don't have the global window, don't also patch global scope
    if (window !== globalWindow) return;
    if (globalSelf) {
      try {
        Object.defineProperty(globalSelf, "navigation", {
          value: navigation,
        });
      } catch (e) {}
    }
    if (typeof globalThis !== "undefined") {
      try {
        Object.defineProperty(globalThis, "navigation", {
          value: navigation,
        });
      } catch (e) {}
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
    const descriptor: PropertyDescriptorMap = {
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
    }
    Object.defineProperties(
        prototype,
        descriptor
    );
    const stateDescriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(history),
        "state"
    );
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
    if (!window.PopStateEvent) return;
    const popStateEventPrototype = window.PopStateEvent.prototype
    if (!popStateEventPrototype) return;
    const descriptor = Object.getOwnPropertyDescriptor(popStateEventPrototype, "state");
    Object.defineProperty(
        popStateEventPrototype,
        "state", {
          ...descriptor,
          get() {
            const original: unknown = descriptor.get.call(this);
            if (!isStateHistoryWithMeta(original)) return original;
            return original[NavigationKey].state;
          }
        }
    );
    Object.defineProperty(
        popStateEventPrototype,
        "originalState", {
          ...descriptor
        }
    );
  }
}

export function getCompletePolyfill(options: NavigationPolyfillOptions = DEFAULT_POLYFILL_OPTIONS): { navigation: Navigation, history: NavigationHistory<object>, apply(): void } {
  const {
    persist: PERSIST_ENTRIES,
    persistState: PERSIST_ENTRIES_STATE,
    history: givenHistory,
    limit: patchLimit,
    patch: PATCH_HISTORY,
    interceptEvents: INTERCEPT_EVENTS,
    window: givenWindow = globalWindow,
    navigation: givenNavigation
  } = {
    // These are super default options, if the object de
    ...DEFAULT_POLYFILL_OPTIONS,
    ...options
  }

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
  let initialMeta: StateHistoryMeta = {
    [NavigationMeta]: true,
    currentIndex: -1,
    entries: [],
    key: "",
    state: undefined
  };
  if (isStateHistoryWithMeta(historyInitialState)) {
    initialMeta = historyInitialState[NavigationKey];
  }
  let initialEntries: NavigationHistoryEntrySerialized[] = initialMeta.entries;

  const HISTORY_INTEGRATION = !!((givenWindow || givenHistory) && history);

  if (!initialEntries.length) {
    let url: string | undefined = undefined;

    if (window.location?.href) {
      url = window.location.href;
    }

    let state = undefined;
    if (!isStateHistoryWithMeta(historyInitialState) && !isStateHistoryMeta(historyInitialState)) {
      // console.log("Using state history direct", historyInitialState, history.state);
      state = historyInitialState;
    }

    const key = v4();
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

  const navigationOptions: NavigationOptions = {
    entries: initialEntries,
    currentIndex: initialMeta?.currentIndex,
    currentKey: initialMeta?.key,
    getState(entry: NavigationHistoryEntry) {
      if (!HISTORY_INTEGRATION) return;
      return getHistoryState(history, entry)
    },
    setState(entry: NavigationHistoryEntry) {
      // console.log({
      //   setState: entry.getState(),
      //   entry
      // })
      if (!HISTORY_INTEGRATION) return;
      if (!entry.sameDocument) return;
      setHistoryState(
          navigation,
          history,
          entry,
          IS_PERSIST,
          patchLimit
      );
    },
    disposeState(entry: NavigationHistoryEntry) {
      if (!HISTORY_INTEGRATION) return;
      disposeHistoryState(
          entry,
          IS_PERSIST
      );
    }
  };

  const navigation: Navigation = givenNavigation ?? new NavigationPolyfill(navigationOptions);

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
        const ignorePopState = new Set<string>();
        const ignoreCurrentEntryChange = new Set<string>();

        navigation.addEventListener("currententrychange", ({ navigationType, from }) => {
          // console.log("<-- currententrychange event listener -->");
          const { currentEntry } = navigation;
          if (!currentEntry) return;
          const { key, url } = currentEntry;
          if (ignoreCurrentEntryChange.delete(key) || !currentEntry?.sameDocument) return;

          const historyState = getNavigationEntryWithMeta(navigation, currentEntry, patchLimit);

          // console.log("currentEntry change", historyState);

          switch (navigationType || "replace") {
            case "push":
              return pushState(historyState, "", url)
            case "replace":
              return replaceState(historyState, "", url)
            case "traverse":
              const delta = currentEntry.index - from.index;
              ignorePopState.add(key);
              return historyGo(delta);
            case "reload":
              // TODO
          }
        });

        window.addEventListener("popstate", (event) => {
          // console.log("<-- popstate event listener -->");
          const { state, originalState } = event;
          const foundState = originalState ?? state;
          if (!isStateHistoryWithMeta(foundState)) return;
          const {
            [NavigationKey]: {
              key
            }
          } = foundState
          if (ignorePopState.delete(key)) return;
          ignoreCurrentEntryChange.add(key);
          let committed;
          try {
            committed = navigation.traverseTo(key).committed;
          } catch (error) {
            if (error instanceof InvalidStateError && !PERSIST_ENTRIES) {
              // ignore the error
              return;
            }
            throw error;
          }

          if (PERSIST_ENTRIES || PERSIST_ENTRIES_STATE) {
            committed
                .then(entry => {
                  const historyState = getNavigationEntryWithMeta(navigation, entry, patchLimit)
                  replaceState(historyState, "", entry.url);
                })
                // Noop catch
                .catch(() => {})
          }
        })

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

function isAppNavigation(evt: MouseEventPrototype) {
  return evt.button === 0 &&
    !evt.defaultPrevented &&
    !evt.metaKey &&
    !evt.altKey &&
    !evt.ctrlKey &&
    !evt.shiftKey
}

/** Checks if this element or any of its parents matches a given `selector` */
function matchesAncestor(givenElement: ElementPrototype | undefined, selector: string): ElementPrototype | undefined {
  let element = getDefaultElement();
  // console.log({ element })
  while (element) {
    if (element.matches(selector)) {
      ok<ElementPrototype>(element);
      return element;
    }
    element = element.parentElement;
  }
  return undefined;

  function getDefaultElement(): ElementPrototype | undefined {
    if (!givenElement) return undefined;
    if (givenElement.matches instanceof Function) return givenElement;
    return givenElement.parentElement;
  }
}
