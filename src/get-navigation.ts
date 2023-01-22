import { globalNavigation } from "./global-navigation";
import type { Navigation } from "./spec/navigation";
import { Navigation as NavigationPolyfill } from "./navigation";

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

    let ignorePopState = false;
    let ignoreCurrentEntryChange = false;

    navigation.addEventListener("currententrychange", ({ navigationType, from }) => {
      if (ignoreCurrentEntryChange) return ignoreCurrentEntryChange = false;

      const { currentEntry } = navigation;
      if (!currentEntry?.sameDocument) return;
      const url = new URL(currentEntry.url, origin);
      const { key } = currentEntry;
      const state = currentEntry.getState<any>() ?? {};
      state["__key__"] = key;

      switch(navigationType) {
        case "push":
          return history.pushState(state, "", url)
        case "replace":
          return history.replaceState(state, "", url)
        case "traverse":
          const entries = navigation.entries();
          const fromIdx = entries.findIndex(e => e === from)
          const currIdx = entries.findIndex(e => e === currentEntry)
          const delta = currIdx - fromIdx;
          ignorePopState = true
          return history.go(delta);
        case "reload":
          return console.warn("TBD")
      }
    });
    window.addEventListener("popstate", (ev) => {
      if (ignorePopState) return ignorePopState = false;

      const { __key__: key } = ev.state ?? {};
      if (key) {
        ignoreCurrentEntryChange = true;
        navigation.traverseTo(key)
      }
    })
  }

  return navigation;
}
