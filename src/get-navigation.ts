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
  }

  return navigation;
}
