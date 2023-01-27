import { globalNavigation } from "./global-navigation";
import type { Navigation } from "./spec/navigation";
import { Navigation as NavigationPolyfill, NavigationRestore } from "./navigation";
import { InvalidStateError } from "./navigation-errors";
import { InternalNavigationNavigateOptions, NavigationDownloadRequest, NavigationFormData, NavigationOriginalEvent, NavigationUserInitiated } from "./create-navigation-transition";
import * as StructuredJSON from './util/structured-json';

let navigation: Navigation;

const history = typeof window !== "undefined" && window.history

export const pushState = history?.pushState.bind(history);
export const replaceState = history?.replaceState.bind(history);
export const historyGo = history?.go.bind(history);
export const back = history?.back.bind(history);
export const forward = history?.forward.bind(history);
const { get: stateGetter, ...stateDesc } = history
  ? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(history), "state")
  : { get: undefined };
const { get: eventStateGetter, ...eventDesc } = history && window.PopStateEvent
  ? Object.getOwnPropertyDescriptor(PopStateEvent.prototype, "state")
  : { get: undefined };
export const getState = stateGetter?.bind(history);

/**
 * Integrate polyfilled Navigation API with legacy History API. 
 * Specifically, `popstate` will trigger navigation traversal and 
 * navigates will push state on History API.
 * This enables forward/backward to work in most cases, but not after page refresh, etc. 
 * See {@link PERSIST_ENTRIES}.
 * 
 * __WIP__: No consideration given to iframes and other edge cases. 
 * `hashchange` not implemented. `scroll` not implemented.
 */
const HISTORY_INTEGRATION = true;

/** 
 * Persists all navigation entries in history state. 
 * This enables forward/backward to work after hard refresh, closing/reopening tab, etc.
 * but comes at the cost of storing all navigation history entries _on every history frame_.
 * This isn't quite as crazy as it seems, as each entry only consists of `url`, `key` and `id`.
 * 
 * __WIP__: Maybe store entries in session storage instead and only keep an id in history state,
 * same as entries state? What's worse, sync access + stringification or endless duplication on history frames 🤔 
 */
const PERSIST_ENTRIES = true;

/**
 * Like {@link PERSIST_ENTRIES}, except also stores the state for each navigation entry.
 * Note that you might not need this if you only need the state from the current navigation entry, 
 * which works with {@link HISTORY_INTEGRATION} alone.
 * Enabled this allows getting the state of any navigation entry even after a hard refresh.
 * 
 * __NOTE__: State is stringified and stored in `sessionStorage`. This works for small objects, 
 * but gets awkward when storing large array buffers, etc...
 */
const PERSIST_ENTRIES_STATE = true;

/**
 * Monkey-patches History methods to call new Navigation API methods internally instead.
 * Combine with {@link HISTORY_INTEGRATION} to
 * Could solve issues when combining Navigation API with frameworks that use History API, 
 * or cause additional issues instead 🤷‍♂️.
 * 
 * __NOTE__: This performs some crazy prototype acrobatics to hide the real history state from the application.
 * If this sounds scary you might want to disable this.
 */
const PATCH_HISTORY = true;

/**
 * Intercepts clicks on `a` tags and `form` submissions.
 * Only works for the most basic cases. ~No download support. No form support.~
 * ~Doesn't fire the correct navigation events. Basically does nothing except prevent default.~
 */
const INTERCEPT_EVENTS = true;

export const __nav__ = "__nav__";

export function getNavigation(): Navigation {
  if (globalNavigation) {
    return globalNavigation;
  }
  if (navigation) {
    return navigation;
  }
  navigation = new NavigationPolyfill()

  if (!history) return navigation;

  // const origin = typeof location === "undefined" ? "https://example.com" : location.origin;

  if (PERSIST_ENTRIES || PERSIST_ENTRIES_STATE) {
    const navMeta = getState()?.[__nav__];
    if (navMeta?.currentIndex > -1) {
      const polyfilled = navigation as NavigationPolyfill;
      polyfilled[NavigationRestore](navMeta.currentIndex, navMeta.entries);
    }
  }

  if (HISTORY_INTEGRATION) {
    const ignorePopState = new Set<string>();
    const ignoreCurrentEntryChange = new Set<string>();

    const copyEntries = () => navigation.entries().map(({ id, key, url }) => ({ id, key, url }));

    navigation.addEventListener("currententrychange", ({ navigationType, from }) => {
      const { currentEntry } = navigation;
      const { id, key, url } = currentEntry;
      if (ignoreCurrentEntryChange.delete(key) || !currentEntry?.sameDocument) return;

      // const { pathname } = new URL(url, origin);
      const state = currentEntry.getState<any>();

      if (PERSIST_ENTRIES_STATE && state != null) {
        const item = sessionStorage.getItem(id)
        if (item == null) {
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
      const hState = { state, [__nav__]: navMeta }

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
      const { state, [__nav__]: { key = "" } = {} } = eventStateGetter.call(ev) ?? {};
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
              const hState = { state, [__nav__]: navMeta };
              replaceState(hState, "", entry.url);
            }, () => {});
        } catch (err) {
          if (err instanceof InvalidStateError && !PERSIST_ENTRIES) { /* ok */ }
          else { throw err }
        }
      }
    })

    window.addEventListener("hashchange", (ev) => {
      // TODO
    })
  }

  if (PATCH_HISTORY) {
    // FIXME: use defineproperty on prototype instead?
    history.pushState = (state, _t, url) => { navigation.navigate(url!, { history: "push", state }) };
    history.replaceState = (state, _t, url) => { navigation.navigate(url!, { history: "replace", state }) };
    history.go = delta => { navigation.traverseTo(navigation.entries()[navigation.currentEntry.index + delta]?.key) };
    history.back = () => { navigation.back() };
    history.forward = () => { navigation.forward() };
    Object.defineProperty(history, "state", { get() { return getState()?.state }, ...stateDesc });
    Object.defineProperty(PopStateEvent.prototype, "state", { get() { return eventStateGetter.call(this)?.state }, ...eventDesc });
  }

  if (INTERCEPT_EVENTS) {
    function clickCallback(ev: MouseEvent, aEl: HTMLAnchorElement) {
      // Move to back of task queue to let other event listeners run 
      // that are also registered on `window` (e.g. Solid.js event delegation). 
      // This gives them a chance to call `preventDefault`, which will be respected by nav api.
      queueMicrotask(() => {
        if (!isAppNavigation(ev)) return;
        const options = { 
          history: "auto",
          [NavigationUserInitiated]: true,
          [NavigationDownloadRequest]: aEl.download,
          [NavigationOriginalEvent]: ev,
        } satisfies InternalNavigationNavigateOptions
        navigation.navigate(aEl.href, options);
      });
    }
    function submitCallback(ev: SubmitEvent, form: HTMLFormElement) {
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
        const options = { 
          history: "auto",
          [NavigationUserInitiated]: true,
          [NavigationFormData]: navFormData,
          [NavigationOriginalEvent]: ev,
        } satisfies InternalNavigationNavigateOptions
        navigation.navigate(url.href, options); 
      });
    }
    window.addEventListener("click", (ev: MouseEvent) => {
      if (ev.target instanceof HTMLElement && ev.target.ownerDocument === document) {
        const aEl = matchesAncestor(ev.target, "a[href]"); // not sure what a tags without href do
        if (aEl)
          clickCallback(ev, aEl as HTMLAnchorElement);
      }
    });
    window.addEventListener("submit", (ev: SubmitEvent) => {
      if (ev.target instanceof HTMLElement && ev.target.ownerDocument === document) {
        const form = matchesAncestor(ev.target, "form");
        if (form) 
          submitCallback(ev, form as HTMLFormElement);
      }
    });
  }

  return navigation;
}

function isAppNavigation(evt: MouseEvent) {
  return evt.button === 0 &&
    !evt.defaultPrevented &&
    !evt.metaKey &&
    !evt.altKey &&
    !evt.ctrlKey &&
    !evt.shiftKey
}

/** Checks if this element or any of its parents matches a given `selector` */
export function matchesAncestor(el: HTMLElement | null, selector: string): HTMLElement | null {
  let curr = el;
  while (curr != null) {
    if (curr.matches(selector)) 
      return curr;
    curr = curr.parentElement;
  }
  return null;
}
