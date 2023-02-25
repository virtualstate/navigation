import {getPolyfill, NavigationPolyfillOptions} from "./get-polyfill";

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
  try {
    Object.defineProperty(window, "navigation", {
      value: navigation,
    });
  } catch (e) {}
  try {
    Object.defineProperty(self, "navigation", {
      value: navigation,
    });
  } catch (e) {}
  try {
    Object.defineProperty(globalThis, "navigation", {
      value: navigation,
    });
  } catch (e) {}
}