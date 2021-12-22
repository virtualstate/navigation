/* c8 ignore start */
// import {run, dispatchEvent, addEventListener} from "@opennetwork/environment";

if (typeof process !== "undefined") {
    process.on("uncaughtException", (...args) => {
        console.log("process uncaught exception", ...args);
        process.exit(1);
    });
    process.on("unhandledRejection", (...args) => {
        console.log("process unhandled rejection", ...args);
        process.exit(1);
    });
    process.on("error", (...args) => {
        console.log("process error", ...args);
        process.exit(1);
    });
}

async function runTests() {
    await import("./app-history.class");
    await import("./app-history.imported");
    if (typeof window === "undefined" && typeof process !== "undefined" && process.env.FLAGS?.includes("PLAYWRIGHT")) {
        await import("./app-history.playwright");
    }
}

if (typeof window !== "undefined" && typeof window.testsComplete && typeof window.testsFailed) {
    try {
        await runTests();
        await window.testsComplete();
    } catch (error) {
        await window.testsFailed(error instanceof Error ? error.message : `${error}`);
        throw error;
    }
} else {
    await runTests()
}

// Settle tests, allow for the above handlers to fire if they need to
await new Promise(resolve => setTimeout(resolve, 200));

// TODO add checks to ensure everything is closed
if (typeof process !== "undefined") {
    process.exit(0);
}

export default 1;