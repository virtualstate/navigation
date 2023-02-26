import {DEFAULT_POLYFILL_OPTIONS, getCompletePolyfill, getPolyfill, NavigationPolyfillOptions} from "./get-polyfill";
import {getNavigation} from "./get-navigation";
import {globalNavigation} from "./global-navigation";

export function applyPolyfill(options: NavigationPolyfillOptions = DEFAULT_POLYFILL_OPTIONS) {
  const { apply } = getCompletePolyfill({ ...DEFAULT_POLYFILL_OPTIONS, ...options });
  apply();
}

export function shouldApplyPolyfill(navigation = getNavigation()) {
  return (
      navigation !== globalNavigation &&
      !globalNavigation &&
      typeof window !== "undefined"
  );
}