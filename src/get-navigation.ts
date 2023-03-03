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
  return (navigation = new NavigationPolyfill());
}