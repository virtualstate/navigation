import { globalNavigation } from "./global-navigation";
import { getNavigation } from "./get-navigation";

console.warn(
  "THIS POLYFILL IS NOT COMPLETE, FOR EXAMPLE IT DOES NOT TAKE INTO ACCOUNT IFRAMES, OR URL UPDATES"
);
console.warn(
  "PLEASE RAISE INTEREST AT https://github.com/virtualstate/navigation/issues"
);

const navigation = getNavigation();

if (
  navigation !== globalNavigation &&
  !globalNavigation &&
  typeof window !== "undefined"
) {
  console.log("Polyfill checking loading");
  // Add usage of transitionWhile for initial navigation to prevent network navigation
  navigation.addEventListener(
    "navigate",
    (event) => event.transitionWhile(Promise.resolve()),
    { once: true }
  );
  await navigation.navigate(window.location.href, window.history?.state)
    .finished;
  console.log("Polyfill checking loaded");
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

export default navigation;
