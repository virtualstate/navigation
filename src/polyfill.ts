console.warn("THIS POLYFILL IS NOT COMPLETE, FOR EXAMPLE IT DOES NOT TAKE INTO ACCOUNT IFRAMES, OR URL UPDATES");
console.warn("PLEASE RAISE INTEREST AT https://github.com/virtualstate/navigation/issues")

/* c8 ignore start */
import { Navigation } from "./navigation";
console.log("Polyfill checking load");
let filled: Navigation;

if (typeof window !== "undefined" && !window.navigation) {
    console.log("Polyfill checking loading");
    filled = new Navigation();
    // Add usage of transitionWhile for initial navigation to prevent network navigation
    filled.addEventListener(
        "navigate",
        (event) => event.transitionWhile(Promise.resolve()),
        { once: true }
    );
    await filled.navigate(
        window.location.href,
        window.history?.state
    ).finished;
    console.log("Polyfill checking loaded");
    try {
        Object.defineProperty(window, "navigation", {
            value: filled
        });
    } catch (e) {

    }
    try {
        Object.defineProperty(self, "navigation", {
            value: filled
        });
    } catch (e) {

    }
    try {
        Object.defineProperty(globalThis, "navigation", {
            value: filled
        });
    } catch (e) {

    }
}

export default filled;