import type { Navigation } from "./spec/navigation";
import { Navigation as NavigationPolyfill, NavigationRestore } from "./navigation";
import { InvalidStateError } from "./navigation-errors";
import { InternalNavigationNavigateOptions, NavigationDownloadRequest, NavigationFormData, NavigationOriginalEvent, NavigationUserInitiated } from "./create-navigation-transition";
import * as StructuredJSON from './util/structured-json';
import {NavigationHistory} from "./history";
import {like, ok} from "./is";

declare var document: unknown;
declare var window: {
  history?: NavigationHistory<object>
  PopStateEvent?: {
    prototype: {
      state: object
    }
  }
  addEventListener(type: "submit", fn: (event: SubmitEventPrototype) => void): void;
  addEventListener(type: "click", fn: (event: MouseEventPrototype) => void): void;
  addEventListener(type: "popstate", fn: (event: EventPrototype) => void): void;

}

const windowHistory: NavigationHistory<object> | undefined = typeof window !== "undefined" ? window.history : undefined;

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
  history?: boolean | History;


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

  window?: Window

  navigation?: Navigation
}

export const NavigationKey = "__@virtualstate/navigation/key";

interface ElementPrototype {
  new(): ElementPrototype;
  ownerDocument: unknown;
  parentElement?: ElementPrototype;
  matches(string: string): boolean;
}

interface HTMLAnchorElementPrototype extends ElementPrototype {
  download: string;
  href: string;
}


interface HTMLFormElementPrototype extends ElementPrototype {
  method: string;
  action: string;
}

interface EventPrototype {
  target: ElementPrototype
  defaultPrevented: unknown;
  submitter: Record<string, unknown>;
}

interface MouseEventPrototype extends EventPrototype {
  button: number;
  metaKey: unknown;
  altKey: unknown;
  ctrlKey: unknown;
  shiftKey: unknown;
}

interface SubmitEventPrototype extends EventPrototype {
}

declare var FormData: {
  new(element: HTMLFormElementPrototype): FormData
}

const globalWindow = typeof window === "undefined" ? undefined : window;

function getWindowHistory(givenWindow: { history?: History | NavigationHistory<object> } = globalWindow) {
  if (typeof givenWindow === "undefined") return undefined;
  return givenWindow.history;
}

export function getStateFromWindowHistory<T extends object = Record<string | symbol, unknown>>(givenWindow: { history?: History | NavigationHistory<object> } = globalWindow): T | undefined {
  const history = getWindowHistory(givenWindow);
  if (!history) return undefined;
  return history.state;
}

export function getPolyfill(options: NavigationPolyfillOptions): Navigation {
  const {
    persist: PERSIST_ENTRIES,
    persistState: PERSIST_ENTRIES_STATE,
    history: HISTORY_INTEGRATION,
    limit: PERSIST_ENTRIES_LIMIT,
    patch: PATCH_HISTORY,
    interceptEvents: INTERCEPT_EVENTS,
    window: givenWindow,
    navigation: givenNavigation
  } = options
  const navigation: Navigation = givenNavigation ?? new NavigationPolyfill()

  const history = options.history && typeof options.history !== "boolean" ? options.history : getWindowHistory(givenWindow);

  const pushState = history?.pushState.bind(history);
  const replaceState = history?.replaceState.bind(history);
  const historyGo = history?.go.bind(history);
// const back = history?.back.bind(history);
// const forward = history?.forward.bind(history);
  const { get: stateGetter, ...stateDesc } = history
  && Object.getOwnPropertyDescriptor(Object.getPrototypeOf(history), "state") || {};
  const defaultStateGetter = {
    get() {
      return {}
    }
  }
  const { get: eventStateGetter, ...eventDesc } = (history && window.PopStateEvent) ? (
      Object.getOwnPropertyDescriptor(window.PopStateEvent?.prototype ?? {}, "state")
  ) ?? defaultStateGetter : defaultStateGetter;

  // const origin = typeof location === "undefined" ? "https://example.com" : location.origin;

  function getState() {
    return stateGetter?.call(history) ?? {};
  }

  if (PERSIST_ENTRIES || PERSIST_ENTRIES_STATE) {
    const navMeta = getState?.()?.[NavigationKey];
    if (navMeta?.currentIndex > -1) {
      const polyfilled = navigation as NavigationPolyfill;
      polyfilled[NavigationRestore](navMeta.currentIndex, navMeta.entries);
    }
  }

  if (HISTORY_INTEGRATION && pushState && replaceState && historyGo) {
    const ignorePopState = new Set<string|undefined>();
    const ignoreCurrentEntryChange = new Set<string|undefined>();

    const copyEntries = () => navigation.entries().slice(-PERSIST_ENTRIES_LIMIT).map(({ id, key, url }) => ({ id, key, url }));

    navigation.addEventListener("currententrychange", ({ navigationType, from }) => {
      const { currentEntry } = navigation;
      const { id, key, url } = currentEntry || {};
      if (ignoreCurrentEntryChange.delete(key) || !currentEntry?.sameDocument) return;

      // const { pathname } = new URL(url, origin);
      const state = currentEntry.getState<any>();

      if (PERSIST_ENTRIES_STATE && id && state != null) {
        if (sessionStorage.getItem(id) == null) {
          const raw = StructuredJSON.stringify(state)
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

    window.addEventListener("popstate", (ev) => {
      const { state, [NavigationKey]: { key = "" } = {} } = eventStateGetter?.call(ev) ?? {};
      if (ignorePopState.delete(key)) return;

      if (key) {
        ignoreCurrentEntryChange.add(key);
        try {
          const committed = navigation.traverseTo(key).committed;
          if (PERSIST_ENTRIES || PERSIST_ENTRIES_STATE) 
            committed.then(entry => {
              const navMeta = {
                key,
                currentIndex: entry.index,
                entries: copyEntries(),
              };
              const hState = { state, [NavigationKey]: navMeta };
              replaceState(hState, "", entry.url);
            }, () => {});
        } catch (err) {
          if (err instanceof InvalidStateError && !PERSIST_ENTRIES) { /* ok */ }
          else { throw err }
        }
      }
    })

    // window.addEventListener("hashchange", (ev) => {
    //   // TODO
    // })
  }

  if (PATCH_HISTORY) {
    // FIXME: use defineproperty on prototype instead?
    history.pushState = (state, _t, url) => { url && navigation.navigate(url, { history: "push", state }) };
    history.replaceState = (state, _t, url) => { url && navigation.navigate(url, { history: "replace", state }) };
    history.go = (delta = 0) => { navigation.currentEntry && navigation.traverseTo(navigation.entries()[navigation.currentEntry.index + delta]?.key) };
    history.back = () => { navigation.back() };
    history.forward = () => { navigation.forward() };
    if (getState)
      Object.defineProperty(history, "state", { get() { return getState()?.state }, ...stateDesc });
    if (eventStateGetter && window.PopStateEvent) {
      Object.defineProperty(window.PopStateEvent.prototype, "state", { get() { return eventStateGetter.call(this)?.state }, ...eventDesc });
    }
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
      if (ev.target instanceof Node && ev.target.ownerDocument === document) {
        const aEl = matchesAncestor(ev.target, "a[href]"); // XXX: not sure what <a> tags without href do
        if (like<HTMLAnchorElementPrototype>(aEl)) {
          clickCallback(ev, aEl);
        }
      }
    });
    window.addEventListener("submit", (ev: SubmitEventPrototype) => {
      if (ev.target instanceof Node && ev.target.ownerDocument === document) {
        const form: unknown = matchesAncestor(ev.target, "form");
        if (like<HTMLFormElementPrototype>(form)) {
          submitCallback(ev, form);
        }
      }
    });
  }

  return navigation;
}

function isAppNavigation(evt: MouseEventPrototype) {
  return evt.button === 0 &&
    !evt.defaultPrevented &&
    !evt.metaKey &&
    !evt.altKey &&
    !evt.ctrlKey &&
    !evt.shiftKey
}

declare var HTMLElement: ElementPrototype;
declare var Node: ElementPrototype;

/** Checks if this element or any of its parents matches a given `selector` */
function matchesAncestor(el: unknown, selector: string): ElementPrototype | undefined {
  let curr: ElementPrototype | undefined = undefined;
  if (el instanceof HTMLElement) {
    curr = el;
  } else if (like<ElementPrototype>(el)) {
    curr = el.parentElement;
  }
  while (curr) {
    if (curr.matches(selector)) {
      ok<ElementPrototype>(curr);
      return curr;
    }
    curr = curr.parentElement;
  }
  return undefined;
}
