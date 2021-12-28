console.warn("THIS POLYFILL IS NOT COMPLETE, FOR EXAMPLE IT DOES NOT TAKE INTO ACCOUNT IFRAMES, OR URL UPDATES");
console.warn("PLEASE RAISE INTEREST AT https://github.com/virtualstate/app-history/issues")

/* c8 ignore start */
import { AppHistory } from "./app-history";
console.log("Polyfill checking load");
let filled: AppHistory;

if (typeof window !== "undefined" && !window.appHistory) {
    console.log("Polyfill checking loading");
    filled = new AppHistory();
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
        Object.defineProperty(window, "appHistory", {
            value: filled
        });
    } catch (e) {

    }
    try {
        Object.defineProperty(self, "appHistory", {
            value: filled
        });
    } catch (e) {

    }
    try {
        Object.defineProperty(globalThis, "appHistory", {
            value: filled
        });
    } catch (e) {

    }
}

export default filled;