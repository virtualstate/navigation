import { globalNavigation } from "./global-navigation";
import type { Navigation } from "./spec/navigation";
import { Navigation as NavigationPolyfill } from "./navigation";

declare module globalThis {
  let $__navigation_virtualstate: Navigation;
}

export function getNavigation(): Navigation {
  if (globalNavigation) {
    return globalNavigation;
  }
  if (globalThis.$__navigation_virtualstate) {
    return globalThis.$__navigation_virtualstate;
  }
  return (globalThis.$__navigation_virtualstate = new NavigationPolyfill());
}
