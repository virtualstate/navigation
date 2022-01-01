/* c8 ignore start */
// import {run, dispatchEvent, addEventListener} from "@opennetwork/environment";
import process from "./node-process";
import {getConfig} from "./config";

console.log("====== START NEW SET OF TESTS ======");


if (typeof process !== "undefined") {
    process.on("uncaughtException", (...args: unknown[]) => {
        console.log("process uncaught exception", ...args);
        process.exit(1);
    });
    process.on("unhandledRejection", (...args: unknown[]) => {
        console.log("process unhandled rejection", ...args);
        process.exit(1);
    });
    process.on("error", (...args: unknown[]) => {
        console.log("process error", ...args);
        process.exit(1);
    });
}

async function runTests() {
    await import("./app-history.class");
    if (typeof window === "undefined" && typeof process !== "undefined") {
        await import("./app-history.imported");
        console.log(getConfig())
        if (getConfig().FLAGS?.includes("PLAYWRIGHT")) {
            await import("./app-history.playwright");
        }
    }
    else {
        await import("./app-history.scope");
    }
}

if (typeof window === "undefined") {
    console.log("Running tests within shell");
} else {
    if (sessionStorage.testsRanInThisWindow) {
        throw new Error("Tests already ran in this window, network navigation caused");
    }
    sessionStorage.setItem("testsRanInThisWindow", "1");
    console.log("Running tests within window");
}
let exitCode = 0,
    caught = undefined;
try {
    await runTests();
} catch (error) {
    caught = error;
    exitCode = 1;
    console.error("Caught test error!");
    if (typeof window === "undefined" && typeof process !== "undefined") {
        console.error(caught);
    } else {
        throw await Promise.reject(caught);
    }
}

// Settle tests, allow for the above handlers to fire if they need to
await new Promise(resolve => setTimeout(resolve, 200));

if (typeof process !== "undefined" && exitCode) {
    process.exit(exitCode);
}

export default exitCode;