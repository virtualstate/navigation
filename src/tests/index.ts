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
  const flags = getConfig().FLAGS;
  const WPT = flags?.includes("WEB_PLATFORM_TESTS"),
      playright = flags?.includes("PLAYWRIGHT")

  if (!playright) {
    await import("./navigation.class");
  }
  if (typeof window === "undefined" && typeof process !== "undefined") {
    if (!playright) {
      await import("./navigation.imported");
      await import("./navigation.scope.faker");
    }
    if (WPT) {
      await import("./navigation.playwright.wpt");
    }
    if (playright) {
      await import("./navigation.playwright");
      await import("./navigation.class");
    }
  } else if (window.navigation) {
    await import("./navigation.scope");
  }
  if (!(WPT || playright)) {
    console.log("Starting routes tests");
    await import("./routes");
    console.log("Starting transition tests");
    await import("./transition");
    console.log("Starting wpt base tests");
    await import("./wpt");
    console.log("Starting commit tests");
    await import("./commit");
    console.log("Starting state tests");
    await import("./state");
    console.log("Starting entrieschange tests");
    await import("./entrieschange");
    console.log("Starting custom state tests");
    await import("./custom-state");
    console.log("Starting original event tests");
    await import("./original-event");
    console.log("Starting same document tests");
    await import("./same-document");
    console.log("Starting await tests");
    await import("./await");
    console.log("Starting dynamic tests");
    await import("./dynamic");
  }
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
