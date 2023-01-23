import { globalNavigation } from "./global-navigation";
import type { Navigation } from "./spec/navigation";
import { Navigation as NavigationPolyfill } from "./navigation";
import { InvalidStateError } from "./navigation-errors";

let navigation: Navigation;

/** 
 * Dragging along all navigation entries in the history state. 
 * This enables forward/backward to work after hard refresh, closing/reopening tab, etc...
 * Comes at the cost of copying entries array _for every history frame_.
 */
const DRAG_ENTRIES = true;

/**
 * Like {@link DRAG_ENTRIES}, except also drags along the state for each entry.
 * Note that this is not recommended, as *all state is duplicate for every history frame* 🤯.
 * The only scenario where this would be required is when calling `getState` on an entry that is not the current entry.
 */
const DRAG_ENTRIES_STATE = false;

/**
 * Monkey patches legacy History API to call new Navigation API methods instead.
 * Could solve issues when combining navigation API with frameworks that use History API. 
 */
const PATCH_HISTORY = true;

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
      return navigation.entries().map(entry => {
        const { id, key, url, sameDocument } = entry;
        return { id, key, url, sameDocument, ...DRAG_ENTRIES_STATE ? { state: entry.getState() } : {} };
      });
    } finally {
      // console.timeEnd("copyEntries")
    }
  }

  if (typeof window !== "undefined" && window.history) {
    const origin = typeof location === "undefined" ? "https://example.com" : location.origin;

    if (DRAG_ENTRIES) {
      const nav = history.state?.[__nav__];
      if (nav && nav.currentIndex > -1 && Array.isArray(nav.entries)) {
        (navigation as NavigationPolyfill).__restoreEntries(nav.currentIndex, nav.entries);
      }
    }

    const pushState = history.pushState.bind(history);
    const replaceState = history.replaceState.bind(history);
    const historyGo = history.go.bind(history);
    // const back = history.back.bind(history);
    // const forward = history.forward.bind(history);

    const ignorePopState = new Set<string>();
    const ignoreCurrentEntryChange = new Set<string>();

    navigation.addEventListener("currententrychange", ({ navigationType, from }) => {
      const { currentEntry } = navigation;
      const { key, url } = currentEntry;
      if (ignoreCurrentEntryChange.delete(key) || !currentEntry?.sameDocument) return;

      const fqUrl = new URL(url, origin);
      const state = currentEntry.getState<any>() ?? {};
      state[__nav__] = { key, ...DRAG_ENTRIES 
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
      const { [__nav__]: { key } } = ev.state ?? {};
      if (ignorePopState.delete(key)) return;

      if (key) {
        ignoreCurrentEntryChange.add(key);
        try {
          const committed = navigation.traverseTo(key).committed;
          if (DRAG_ENTRIES) committed.then(entry => {
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

    if (PATCH_HISTORY) {
      history.pushState = (state, _t, url) => navigation.navigate(url!, { history: "push", state });
      history.replaceState = (state, _t, url) => navigation.navigate(url!, { history: "replace", state });
      history.go = delta => navigation.traverseTo(navigation.entries()[navigation.currentEntry.index + delta]?.key);
      history.back = () => navigation.back();
      history.forward = () => navigation.forward();
    }

    // function preventDefault(e: MouseEvent) {
    //   if (e.target instanceof HTMLAnchorElement) {
    //     e.preventDefault(); // HACK: Instead of calling this immediately, should pass it along and call when intercept is called
    //     const a = e.target;
    //     a.download // TODO: Needs to fire the correct event with downloadRequest set to true
    //     navigation.navigate(a.href);
    //   }
    //   else if (e.target instanceof HTMLFormElement) {
    //     e.preventDefault();
    //     // TODO
    //   }
    // }
    // const mutObs = new MutationObserver(mutations => {
    //   for (const { addedNodes, removedNodes } of mutations) {
    //     const aLen = addedNodes.length;
    //     const rLen = removedNodes.length;
    //     for (let i = 0; i < aLen; i++) {
    //       const el = addedNodes[i];
    //       if (!(el instanceof Element)) continue;

    //       const as = el.querySelectorAll('a');
    //       for (let j = 0; j < as.length; j++) {
    //         as[j].addEventListener("click", preventDefault);
    //       }
    //       // TODO: forms
    //     }
    //     for (let i = 0; i < rLen; i++) {
    //       const el = removedNodes[i];
    //       if (!(el instanceof Element)) continue;

    //       const as = el.querySelectorAll('a');
    //       for (let j = 0; j < as.length; j++) {
    //         as[j].removeEventListener("click", preventDefault);
    //       }
    //       // TODO: forms
    //     }
    //   }
    // });
    // mutObs.observe(document.body, {
    //   subtree: true, 
    //   childList: true, 
    //   attributes: false, 
    //   characterData: false
    // })
  }

  return navigation;
}
