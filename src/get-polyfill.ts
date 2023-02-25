import type {Navigation, NavigationHistoryEntry} from "./spec/navigation";
import { Navigation as NavigationPolyfill, NavigationSetEntries } from "./navigation";
import { InvalidStateError } from "./navigation-errors";
import { InternalNavigationNavigateOptions, NavigationDownloadRequest, NavigationFormData, NavigationOriginalEvent, NavigationUserInitiated } from "./create-navigation-transition";
import { stringify, parse } from './util/structured-json';
import {NavigationHistory} from "./history";
import {like, ok} from "./is";
import {
  ElementPrototype,
  globalWindow,
  HTMLAnchorElementPrototype,
  HTMLFormElementPrototype,
  MouseEventPrototype, SubmitEventPrototype,
  WindowLike
} from "./global-window";
import {globalSelf} from "./global-self";

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

interface StateHistoryMeta {
  key: string;
  currentIndex: number;
  entries: { key: string, url: string }[];
}

interface StateHistoryWithMeta {
  [NavigationKey]: StateHistoryMeta
}

function isStateHistoryWithMeta<T>(state: T): state is T & StateHistoryWithMeta {
  return like<StateHistoryWithMeta>(state) && !!state[NavigationKey];
}

function getHistoryState<T extends object>(
    history: NavigationHistory<T>,
    entry: NavigationHistoryEntry<T>
): T {
  return (
      getStateFromHistoryIfMatchingKey() ??
      getStateFromSession()
  );

  function getBaseState() {
    const value = history.state;
    return like<T>(value) ? value : undefined;
  }

  function getStateFromHistoryIfMatchingKey() {
    const state = getBaseState();
    if (!isStateHistoryWithMeta(state)) return undefined;
    if (state[NavigationKey].key !== entry.key) return undefined;
    return state;
  }

  function getStateFromSession(): T | undefined {
    if (typeof sessionStorage === "undefined") return undefined;
    const raw = sessionStorage.getItem(entry.key);
    if (!raw) return undefined;
    return parse(raw);
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
  return !!navigation;
}

function getNavigationOnlyPolyfill() {
  const navigation = new NavigationPolyfill();
  const history = new NavigationHistory<object>({
    navigation
  })
  return {
    navigation,
    history,
    async apply() {}
  }
}

export function getCompletePolyfill(options: NavigationPolyfillOptions = DEFAULT_POLYFILL_OPTIONS): { navigation: Navigation, history: NavigationHistory<object>, apply(): Promise<void> } {
  const {
    persist: PERSIST_ENTRIES,
    persistState: PERSIST_ENTRIES_STATE,
    history: givenHistory,
    limit: PERSIST_ENTRIES_LIMIT,
    patch: PATCH_HISTORY,
    interceptEvents: INTERCEPT_EVENTS,
    window: givenWindow = globalWindow,
    navigation: givenNavigation
  } = {
    // These are super default options, if the object de
    ...DEFAULT_POLYFILL_OPTIONS,
    ...options
  }

  const history = options.history && typeof options.history !== "boolean" ? options.history : getWindowHistory(givenWindow);

  if (!history) {
    return getNavigationOnlyPolyfill();
  }

  // Use baseHistory so that we don't initialise entries we didn't intend to
  // if we used a polyfill history
  const historyInitialState = history?.state;
  const initialEntries = (
      isStateHistoryWithMeta(historyInitialState) ? (
          historyInitialState[NavigationKey].entries
      ) : undefined
  )

  function getState(entry: NavigationHistoryEntry) {
    return getHistoryState(history, entry)
  }

  const navigation: Navigation = givenNavigation ?? new NavigationPolyfill({
    entries: initialEntries,
    getState
  })

  function getCurrentState() {
    return getState(navigation.currentEntry);
  }

  const HISTORY_INTEGRATION = !!((givenWindow || givenHistory) && history);

  const window = givenWindow;
  ok(window, "window required");
  const document = window.document;

  const pushState = history?.pushState.bind(history);
  const replaceState = history?.replaceState.bind(history);
  const historyGo = history?.go.bind(history);
  // const back = history?.back.bind(history);
  // const forward = history?.forward.bind(history);

  // const origin = typeof location === "undefined" ? "https://example.com" : location.origin;

  return {
    navigation,
    history,
    async apply() {
      if (
          isNavigationPolyfill(givenNavigation) &&
          (PERSIST_ENTRIES || PERSIST_ENTRIES_STATE) &&
          initialEntries
      ) {
        givenNavigation[NavigationSetEntries](initialEntries);
      }

      if (HISTORY_INTEGRATION) {
        const ignorePopState = new Set<string|undefined>();
        const ignoreCurrentEntryChange = new Set<string|undefined>();

        const limit = PERSIST_ENTRIES_LIMIT ?? 50;

        const copyEntries = () => navigation.entries().slice(-limit).map(({ id, key, url }) => ({ id, key, url }));

        navigation.addEventListener("currententrychange", ({ navigationType, from }) => {
          const { currentEntry } = navigation;
          const { id, key, url } = currentEntry || {};
          if (ignoreCurrentEntryChange.delete(key) || !currentEntry?.sameDocument) return;

          // const { pathname } = new URL(url, origin);
          const state = currentEntry.getState<any>();

          if (PERSIST_ENTRIES_STATE && id && state != null) {
            if (sessionStorage.getItem(id) == null) {
              const raw = stringify(state)
              sessionStorage.setItem(id, raw);
              // Cleaning up some session storage early... no biggie if we miss some
              currentEntry.addEventListener("dispose", e => { sessionStorage.removeItem((e.detail as any)?.entry.id) });
            }
          }

          const navMeta = {
            key,
            ...PERSIST_ENTRIES || PERSIST_ENTRIES_STATE
                ? { currentIndex: currentEntry.index, entries: copyEntries() }
                : {},
          };
          const hState = { state, [NavigationKey]: navMeta }

          switch (navigationType) {
            case "push":
              return pushState(hState, "", url)
            case "replace":
              return replaceState(hState, "", url)
            case "traverse":
              const delta = currentEntry.index - from.index;
              ignorePopState.add(key);
              return historyGo(delta);
            case "reload":
              // TODO
          }
        });

        window.addEventListener("popstate", (event) => {
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
                  const meta = {
                    key,
                    currentIndex: entry.index,
                    entries: copyEntries(),
                  };
                  const historyState = {
                    ...state,
                    [NavigationKey]: meta
                  };
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
        function clickCallback(ev: MouseEventPrototype, aEl: HTMLAnchorElementPrototype) {
          // Move to back of task queue to let other event listeners run
          // that are also registered on `window` (e.g. Solid.js event delegation).
          // This gives them a chance to call `preventDefault`, which will be respected by nav api.
          queueMicrotask(() => {
            if (!isAppNavigation(ev)) return;
            ok<Event>(ev);
            const options: InternalNavigationNavigateOptions = {
              history: "auto",
              [NavigationUserInitiated]: true,
              [NavigationDownloadRequest]: aEl.download,
              [NavigationOriginalEvent]: ev,
            };
            navigation.navigate(aEl.href, options);
          });
        }
        function submitCallback(ev: SubmitEventPrototype, form: HTMLFormElementPrototype) {
          queueMicrotask(() => {
            if (ev.defaultPrevented) return;
            const method = ev.submitter && 'formMethod' in ev.submitter && ev.submitter.formMethod
                ? ev.submitter.formMethod as string
                : form.method;
            // XXX: safe to ignore dialog method?
            if (method === 'dialog') return;
            const action = ev.submitter && 'formAction' in ev.submitter && ev.submitter.formAction
                ? ev.submitter.formAction as string
                : form.action;
            const formData = new FormData(form);
            const params = method === 'get'
                ? new URLSearchParams([...formData].map(([k, v]) => v instanceof File ? [k, v.name] : [k, v]))
                : undefined;
            const navFormData = method === 'post'
                ? formData
                : undefined;
            const url = new URL(action); // action is always a fully qualified url
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
          });
        }
        window.addEventListener("click", (ev: MouseEventPrototype) => {
          if (ev.target?.ownerDocument === document) {
            const aEl = matchesAncestor(ev.target, "a[href]"); // XXX: not sure what <a> tags without href do
            if (like<HTMLAnchorElementPrototype>(aEl)) {
              clickCallback(ev, aEl);
            }
          }
        });
        window.addEventListener("submit", (ev: SubmitEventPrototype) => {
          if (ev.target?.ownerDocument === document) {
            const form: unknown = matchesAncestor(ev.target, "form");
            if (like<HTMLFormElementPrototype>(form)) {
              submitCallback(ev, form);
            }
          }
        });
      }

      if (PATCH_HISTORY) {

        if (navigation.entries().length === 0) {
          navigation.addEventListener(
              "navigate",
              // Add usage of intercept for initial navigation to prevent network navigation
              (event) => event.intercept(Promise.resolve()),
              { once: true }
          );
          const historyState = window.history?.state;
          await navigation.navigate(window.location?.href ?? "/", {
            state: (historyState && typeof historyState === "object") ? historyState : undefined
          })
              .finished;
        }

        // console.log("Polyfill checking loaded");
        if (globalWindow) {
          try {
            Object.defineProperty(globalWindow, "navigation", {
              value: navigation,
            });
          } catch (e) {}
          if (!globalWindow.history) {
            try {
              Object.defineProperty(globalWindow, "history", {
                value: history,
              });
            } catch (e) {}
          }
        }
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

      if (PATCH_HISTORY && history) {
        const history = new NavigationHistory({
          navigation
        });
        const pushState = history.pushState.bind(history);
        const replaceState = history.replaceState.bind(history);
        const go = history.go.bind(history);
        const back = history.back.bind(history);
        const forward = history.forward.bind(history);
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
        Object.defineProperty(history, "state", {
          ...Object.getOwnPropertyDescriptor(
              Object.getPrototypeOf(history),
              "state"
          ),
          get: getCurrentState
        })
        if (history && window.PopStateEvent) {
          const popStateEventPrototype = window.PopStateEvent.prototype
          if (popStateEventPrototype) {
            const descriptor = Object.getOwnPropertyDescriptor(popStateEventPrototype, "state");
            Object.defineProperty(
                popStateEventPrototype,
                "state", {
                  ...descriptor,
                  get() {
                    return descriptor.get.call(this)
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
