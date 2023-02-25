import {getPolyfill, NavigationPolyfillOptions} from "./get-polyfill";
import {getNavigation} from "./get-navigation";
import {globalNavigation} from "./global-navigation";

const globalSelf = self;
const globalWindow = typeof window === "undefined" ? undefined : window;

export async function applyPolyfill(options: NavigationPolyfillOptions = {}) {
  const navigation = getPolyfill(options);
  if (navigation.entries().length === 0) {
    navigation.addEventListener(
        "navigate",
        // Add usage of intercept for initial navigation to prevent network navigation
        (event) => event.intercept(Promise.resolve()),
        { once: true }
    );
    await navigation.navigate(window.location.href, window.history?.state)
        .finished;
  }
  // console.log("Polyfill checking loaded");
  if (globalWindow) {
    try {
      Object.defineProperty(globalWindow, "navigation", {
        value: navigation,
      });
    } catch (e) {}
  }
  if (globalSelf) {
    try {
      Object.defineProperty(globalSelf, "navigation", {
        value: navigation,
      });
    } catch (e) {}
  }
  if (typeof globalThis !== "undefined") {
    try {
      Object.defineProperty(globalThis, "navigation", {
        value: navigation,
      });
    } catch (e) {}
  }
}

export function shouldApplyPolyfill(navigation = getNavigation()) {
  return (
      navigation !== globalNavigation &&
      !globalNavigation &&
      typeof window !== "undefined"
  );
}