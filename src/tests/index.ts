/* c8 ignore start */
// import {run, dispatchEvent, addEventListener} from "@opennetwork/environment";
import process from "./node-process";
import {getConfig} from "./config";

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
        if (getConfig().FLAGS?.includes("PLAYWRIGHT")) {
            await import("./app-history.playwright");
        }
    }
    // else {
    //     await import("./app-history.scope");
    // }
}

if (typeof window === "undefined") {
    console.log("Running tests within shell");
} else {
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
    console.error(caught);
}

// Settle tests, allow for the above handlers to fire if they need to
await new Promise(resolve => setTimeout(resolve, 200));

if (typeof process !== "undefined" && exitCode) {
    process.exit(exitCode);
}

export default exitCode;