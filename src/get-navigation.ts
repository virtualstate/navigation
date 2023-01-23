import { globalNavigation } from "./global-navigation";
import type { Navigation } from "./spec/navigation";
import { Navigation as NavigationPolyfill } from "./navigation";
import { InvalidStateError } from "./navigation-errors";

let navigation: Navigation;

export function getNavigation(): Navigation {
  if (globalNavigation) {
    return globalNavigation;
  }
  if (navigation) {
    return navigation;
  }
  navigation = new NavigationPolyfill()

  if (typeof window !== "undefined" && window.history) {
    const origin = typeof location === "undefined" ? "https://example.com" : location.origin;

    const ignorePopState = new Set<string>();
    const ignoreCurrentEntryChange = new Set<string>();

    navigation.addEventListener("currententrychange", ({ navigationType, from }) => {
      const { currentEntry } = navigation;
      const { key } = currentEntry;
      if (ignoreCurrentEntryChange.delete(key) || !currentEntry?.sameDocument) return;

      const url = new URL(currentEntry.url, origin);
      const state = currentEntry.getState<any>() ?? {};
      state["__key__"] = key;

      switch (navigationType) {
        case "push":
          return history.pushState(state, "", url)
        case "replace":
          return history.replaceState(state, "", url)
        case "traverse":
          const entries = navigation.entries();
          const fromIdx = entries.findIndex(e => e === from)
          const currIdx = entries.findIndex(e => e === currentEntry)
          const delta = currIdx - fromIdx;
          ignorePopState.add(key);
          return history.go(delta);
      }
    });

    window.addEventListener("popstate", (ev) => {
      const { __key__: key } = ev.state ?? {};
      if (ignorePopState.delete(key)) return;

      if (key) {
        ignoreCurrentEntryChange.add(key);
        try {
          navigation.traverseTo(key)
        } catch (err) {
          if (err instanceof InvalidStateError) {}
          else { throw err }
        }
      }
    })

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
