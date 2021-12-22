/* c8 ignore start */
// import {run, dispatchEvent, addEventListener} from "@opennetwork/environment";
import process from "./node-process";

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
        if (process.env.FLAGS?.includes("PLAYWRIGHT")) {
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
await runTests();

// Settle tests, allow for the above handlers to fire if they need to
await new Promise(resolve => setTimeout(resolve, 200));

// TODO add checks to ensure everything is closed
if (typeof process !== "undefined") {
    // process.exit(0);
}

export default 1;