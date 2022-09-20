/* c8 ignore start */
// import {run, dispatchEvent, addEventListener} from "@opennetwork/environment";
import process from "./node-process";
import { getConfig } from "./config";

console.log("====== START NEW SET OF TESTS ======");

if (typeof process !== "undefined" && process.on) {
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
  await import("./navigation.class");
  if (typeof window === "undefined" && typeof process !== "undefined") {
    await import("./navigation.imported");
    if (getConfig().FLAGS?.includes("WEB_PLATFORM_TESTS")) {
      await import("./navigation.playwright.wpt");
    }
    if (getConfig().FLAGS?.includes("PLAYWRIGHT")) {
      await import("./navigation.playwright");
    }
  } else {
    // await import("./navigation.scope");
  }
  await import("./routes");
  await import("./transition");
  await import("./wpt");
  await import("./commit");
}

if (typeof window === "undefined") {
  console.log("Running tests within shell");
} else {
  if (sessionStorage.testsRanInThisWindow) {
    throw new Error(
      "Tests already ran in this window, network navigation caused"
    );
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
await new Promise((resolve) => setTimeout(resolve, 200));

if (typeof process !== "undefined" && exitCode) {
  process.exit(exitCode);
}

export default exitCode;
