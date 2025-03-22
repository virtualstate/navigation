import {DEFAULT_POLYFILL_OPTIONS, getCompletePolyfill, getPolyfill, NavigationPolyfillOptions} from "./get-polyfill";
import {getNavigation} from "./get-navigation";
import {globalNavigation} from "./global-navigation";

export function applyPolyfill(options: NavigationPolyfillOptions = DEFAULT_POLYFILL_OPTIONS) {
  const { apply, navigation } = getCompletePolyfill(options);
  apply();
  return navigation;
}

export function shouldApplyPolyfill(navigation = getNavigation()) {
  const globalThat: { Element?: unknown, navigation?: unknown } = globalThis;
    return (
      navigation !== globalNavigation &&
      (
          !Object.hasOwn(globalThat, 'navigation') ||
          (
              "Element" in globalThat &&
              "navigation" in globalThat &&
              globalThat.Element &&
              globalThat.navigation instanceof globalThis.Element
          )
      ) &&
      typeof window !== "undefined"
  );
}
