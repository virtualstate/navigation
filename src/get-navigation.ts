import { globalNavigation } from "./global-navigation";
import type { Navigation } from "./spec/navigation";
import { Navigation as NavigationPolyfill } from "./navigation";
import { InvalidStateError } from "./navigation-errors";
import * as StructuredJSON from "@worker-tools/structured-json"
import { InternalNavigationNavigateOptions, NavigationDownloadRequest, NavigationFormData, NavigationOriginalEvent, NavigationUserInitiated } from "./create-navigation-transition";

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
 * Navigation API navigates will push state on History API.
 * This enables forward/backward to work in most cases, but not after page refresh, etc. 
 * See {@link DRAG_ENTRIES}.
 * 
 * __WIP__: No consideration given to iframes and other edge cases. `hashchange` not implemented.
 */
const HISTORY_INTEGRATION = true;

/** 
 * Dragging along all navigation entries in the history state. 
 * This enables forward/backward to work after hard refresh, closing/reopening tab, etc...
 * but comes at the cost of copying the navigation history entries array _for every history frame_.
 */
const DRAG_ENTRIES = true;

/**
 * Like {@link DRAG_ENTRIES}, except also stores the state for each navigation entry.
 * Note that you might not need this if you only ever request the state from the current navigation entry, 
 * which works with {@link HISTORY_INTEGRATION} alone.
 * Setting to true allows getting the state of any navigation entry even faster hard refresh.
 * 
 * __NOTE__: State is stringified and stored in `sessionStorage`. This works for small objects, 
 * but gets awkward when storing large array buffers, etc...
 */
const DRAG_ENTRIES_STATE = true;

/**
 * Monkey-patches History API to call new Navigation API methods instead.
 * Could solve issues when combining Navigation API with frameworks that use History API, 
 * or cause additional issues instead 🤷‍♂️.
 * 
 * **NOTE**: This performs some crazy prototype acrobatics to hide the real history state from the application.
 * If this sounds scary you might want to disable this.
 */
const PATCH_HISTORY = true;

/**
 * __EXPERIMENTAL__: Attempts to intercept clicks an `<a/>` tags and `<form/>` submissions.
 * Only works for the most basic cases. ~No download support. No form support.~
 * ~Doesn't fire the correct navigation events. Basically does nothing except prevent default.~
 */
const SPY_ON_DOM = true;

export const __nav__ = "__nav__";

export function getNavigation(): Navigation {
  if (globalNavigation) {
    return globalNavigation;
  }
  if (navigation) {
    return navigation;
  }
  navigation = new NavigationPolyfill()

  function copyEntries() {
    try {
      // console.time("copyEntries")
      return navigation.entries().map(({ id, key, url, sameDocument }) => ({ id, key, url, sameDocument }));
    } finally {
      // console.timeEnd("copyEntries")
    }
  }

  if (!history) return navigation;

  const origin = typeof location === "undefined" ? "https://example.com" : location.origin;

  if (DRAG_ENTRIES || DRAG_ENTRIES_STATE) {
    const navMeta = getState()?.[__nav__];
    if (navMeta && navMeta.currentIndex > -1) {
      (navigation as NavigationPolyfill).__restoreEntries(navMeta.currentIndex, navMeta.entries);
    }
  }

  if (HISTORY_INTEGRATION) {
    const ignorePopState = new Set<string>();
    const ignoreCurrentEntryChange = new Set<string>();

    navigation.addEventListener("currententrychange", ({ navigationType, from }) => {
      const { currentEntry } = navigation;
      const { id, key, url } = currentEntry;
      if (ignoreCurrentEntryChange.delete(key) || !currentEntry?.sameDocument) return;

      const fqUrl = new URL(url, origin);
      const state = currentEntry.getState<any>();

      if (DRAG_ENTRIES_STATE && state != null) {
        const item = sessionStorage.getItem(id)
        if (!item) {
          const raw = StructuredJSON.stringify(state)
          raw != null && sessionStorage.setItem(id, raw);
          // Cleaning up some session storage early:
          currentEntry.addEventListener("dispose", e => { sessionStorage.removeItem((e.detail as any)?.entry.id) });
        }
      }

      const navMeta = { 
        key, 
        ...DRAG_ENTRIES || DRAG_ENTRIES_STATE 
          ? { currentIndex: currentEntry.index, entries: copyEntries() } 
          : {},
      };
      const hState = { state, [__nav__]: navMeta }

      switch (navigationType) {
        case "push":
          return pushState(hState, "", fqUrl)
        case "replace":
          return replaceState(hState, "", fqUrl)
        case "traverse":
          const delta = currentEntry.index - from.index;
          ignorePopState.add(key);
          return historyGo(delta);
      }
    });

    window.addEventListener("popstate", (ev) => {
      const { state, [__nav__]: { key = "" } = {} } = eventStateGetter.call(ev) ?? {};
      if (ignorePopState.delete(key)) return;

      if (key) {
        ignoreCurrentEntryChange.add(key);
        try {
          const committed = navigation.traverseTo(key).committed;
          if (DRAG_ENTRIES || DRAG_ENTRIES_STATE) 
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
          if (err instanceof InvalidStateError) {}
          else { throw err }
        }
      }
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

  if (SPY_ON_DOM) {
    function clickCallback(ev: MouseEvent, aEl: HTMLAnchorElement) {
      const options = { 
        history: "auto",
        [NavigationUserInitiated]: true,
        [NavigationDownloadRequest]: aEl.download,
        [NavigationOriginalEvent]: ev,
      } satisfies InternalNavigationNavigateOptions
      navigation.navigate(aEl.href, options);
    }
    function submitCallback(ev: SubmitEvent, form: HTMLFormElement) {
      const action = ev.submitter && 'formAction' in ev.submitter
        ? ev.submitter.formAction as string
        : form.action
      const options = { 
        history: "auto",
        [NavigationUserInitiated]: true,
        [NavigationFormData]: new FormData(form),
        [NavigationOriginalEvent]: ev,
      } satisfies InternalNavigationNavigateOptions
      navigation.navigate(action, options); 
    }
    document.body.addEventListener("click", (ev: MouseEvent) => {
      if (ev.defaultPrevented) return;
      if (ev.target instanceof Element) {
        const aEl = matchAncestors(ev.target, "a[href]");
        if (aEl)
          clickCallback(ev, aEl as HTMLAnchorElement);
      }
    });
    document.body.addEventListener("submit", (ev: SubmitEvent) => {
      if (ev.defaultPrevented) return;
      if (ev.target instanceof Element) {
        const form = matchAncestors(ev.target, "form");
        if (form) 
          submitCallback(ev, form as HTMLFormElement);
      }
    });
  }

  return navigation;
}

/** Checks if this element or any of its parents matches a given `selector` */
export function matchAncestors(el: Element | null, selector: string): Element | null {
  let curr = el;
  while (curr != null) {
    if (curr.matches(selector)) return curr;
    curr = curr.parentNode instanceof Element ? curr.parentNode : null;
  }
  return null;
}
