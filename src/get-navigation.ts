import { globalNavigation } from "./global-navigation";
import type { Navigation } from "./spec/navigation";
import { Navigation as NavigationPolyfill } from "./navigation";
import { InvalidStateError } from "./navigation-errors";
import * as StructuredJSON from "@worker-tools/structured-json"
import { NavigationHistoryEntry } from "navigation-entry";

let navigation: Navigation;

type EntryData = Pick<NavigationHistoryEntry, "id"|"key"|"url"|"sameDocument"|"state">

/**
 * Integrate patched Navigation API with History API. 
 * Specifically, `popstate` will trigger navigation traversal and 
 * Navigation API navigates will push state on History API.
 * This enables forward/backward to work in basic cases.
 * 
 * __WIP__: No consideration given to iframes and other edge cases. `hashchange` not implemented.
 */
const HISTORY_INTEGRATION = true;

/** 
 * Dragging along all navigation entries in the history state. 
 * This enables forward/backward to work after hard refresh, closing/reopening tab, etc...
 * Comes at the cost of copying entries array _for every history frame_.
 */
const DRAG_ENTRIES = true;

/**
 * Like {@link DRAG_ENTRIES}, except also drags along the state for each navigation entry.
 * The only scenario where this would be required is when calling `getState` on an entry that is not the current entry.
 */
const DRAG_ENTRIES_STATE = true;

/**
 * Monkey-patches History API to call new Navigation API methods instead.
 * Could solve issues when combining Navigation API with frameworks that use History API, 
 * or cause additional issues 🤷‍♂️
 */
const PATCH_HISTORY = true;

/**
 * __Experimental__:
 * Adds a `MutationObserver` to spy on `<a/>` tags and prevent default behavior.
 * If your app uses Navigation/History APIs exclusively, you're likely not going to need need this.
 * __WIP__: Only works for the most basic cases. Adds performance overhead. No download support. No form support.
 */
const SPY_ON_TAGS = true;

const __nav__ = "__nav__";

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

  if (typeof window !== "undefined" && window.history) {
    const origin = typeof location === "undefined" ? "https://example.com" : location.origin;

    if (DRAG_ENTRIES || DRAG_ENTRIES_STATE) {
      const nav = history.state?.[__nav__];
      if (nav && nav.currentIndex > -1 && Array.isArray(nav.entries)) {
        const entries = !DRAG_ENTRIES_STATE
          ? nav.entries
          : nav.entries.map((entry: EntryData) => {
            const raw = sessionStorage.getItem(entry.id);
            if (raw != null) entry.state = StructuredJSON.parse(raw);
            return entry;
          });
        (navigation as NavigationPolyfill).__restoreEntries(nav.currentIndex, entries);
      }
    }

    const pushState = history.pushState.bind(history);
    const replaceState = history.replaceState.bind(history);
    const historyGo = history.go.bind(history);
    // const back = history.back.bind(history);
    // const forward = history.forward.bind(history);

    if (HISTORY_INTEGRATION) {
      const ignorePopState = new Set<string>();
      const ignoreCurrentEntryChange = new Set<string>();

      navigation.addEventListener("currententrychange", ({ navigationType, from }) => {
        const { currentEntry } = navigation;
        const { id, key, url } = currentEntry;
        if (ignoreCurrentEntryChange.delete(key) || !currentEntry?.sameDocument) return;

        const fqUrl = new URL(url, origin);
        const state = currentEntry.getState<any>() ?? {};

        if (DRAG_ENTRIES_STATE) {
          const item = sessionStorage.getItem(id)
          if (!item) {
            const raw = StructuredJSON.stringify(state)
            raw != null && sessionStorage.setItem(id, raw);
          }
          // Trying to clear up some session storage early
          // FIXME: does this work? 
          from.addEventListener("dispose", e => { 
            console.log("dispose?")
            sessionStorage.removeItem((e.detail as any).entry.key) 
          });
        }

        // FIXME: don't assume object
        state[__nav__] = { 
          key, 
          ...DRAG_ENTRIES || DRAG_ENTRIES_STATE 
            ? { currentIndex: currentEntry.index, entries: copyEntries() } 
            : {},
        };

        switch (navigationType) {
          case "push":
            return pushState(state, "", fqUrl)
          case "replace":
            return replaceState(state, "", fqUrl)
          case "traverse":
            const delta = currentEntry.index - from.index;
            ignorePopState.add(key);
            return historyGo(delta);
        }
      });

      window.addEventListener("popstate", (ev) => {
        const { [__nav__]: { key = "" } = {} } = ev.state ?? {};
        if (ignorePopState.delete(key)) return;

        if (key) {
          ignoreCurrentEntryChange.add(key);
          try {
            const committed = navigation.traverseTo(key).committed;
            if (DRAG_ENTRIES || DRAG_ENTRIES_STATE) committed.then(entry => {
              replaceState({ 
                ...history.state, 
                __nav__: {
                  key,
                  currentIndex: entry.index,
                  entries: copyEntries(),
                },
              }, "", entry.url);
            });
          } catch (err) {
            if (err instanceof InvalidStateError) {}
            else { throw err }
          }
        }
      })
    }

    if (PATCH_HISTORY) {
      history.pushState = (state, _t, url) => { navigation.navigate(url!, { history: "push", state }) };
      history.replaceState = (state, _t, url) => { navigation.navigate(url!, { history: "replace", state }) };
      history.go = delta => { navigation.traverseTo(navigation.entries()[navigation.currentEntry.index + delta]?.key) };
      history.back = () => { navigation.back() };
      history.forward = () => { navigation.forward() };
    }

    if (SPY_ON_TAGS) {
      function clickCallback(ev: MouseEvent) {
        const a = ev.target as HTMLAnchorElement;
        ev.preventDefault(); // HACK: Instead of calling this immediately, should pass it along and call when intercept is called
        a.download // TODO: Needs to fire the correct event with downloadRequest set to true
        navigation.navigate(a.href); // FIXME: needs a private method that dispatches the correct event
      }
      function submitCallback(ev: SubmitEvent) {
        // TODO
        // const form = ev.target as HTMLFormElement;
        // ev.preventDefault(); // HACK: Instead of calling this immediately, should pass it along and call when intercept is called
      }
      function addListeners(el: HTMLElement) {
        if (el instanceof HTMLAnchorElement)
          el.addEventListener("click", clickCallback);
        const as = el.getElementsByTagName('a');
        const asLength = as.length;
        for (let i = 0; i < asLength; i++)
          as[i].addEventListener("click", clickCallback);
        // TODO: forms
      }
      function removeListeners(el: HTMLElement) {
        if (el instanceof HTMLAnchorElement)
          el.removeEventListener("click", clickCallback);
        const as = el.getElementsByTagName('a');
        const asLength = as.length;
        for (let i = 0; i < asLength; i++)
          as[i].removeEventListener("click", clickCallback);
        // TODO: forms
      }
      const mutationObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          const addedNodes = mutation.addedNodes;
          const removedNodes = mutation.removedNodes;
          const addedLength = addedNodes.length;
          const removedLength = removedNodes.length;
          for (let i = 0; i < addedLength; i++) {
            const el = addedNodes[i];
            if (el instanceof HTMLElement)
              addListeners(el);
          }
          for (let i = 0; i < removedLength; i++) {
            const el = removedNodes[i];
            if (el instanceof HTMLElement)
              removeListeners(el)
          }
        }
      });
      mutationObserver.observe(document.body, { subtree: true, childList: true });
      addListeners(document.body);
    }
  }

  return navigation;
}
