/* c8 ignore start */
import { Navigation } from "../spec/navigation";
import * as Examples from "./examples";
import { getConfig } from "./config";
import { isWindowNavigation } from "./util";
import { NavigationNavigation } from "../navigation-navigation";

export interface NavigationAssertFn {
  (given: unknown): asserts given is () => Navigation;
}

declare global {
  interface History {
    pushState(data: unknown, unused: string, url?: string | URL): void;
  }
  interface Navigation {}
  interface Window {
    readonly history: History;
    readonly navigation: Navigation;
  }
}

export async function assertNavigation(
  createNavigation: () => unknown
): Promise<NavigationAssertFn> {
  let caught: unknown;

  const tests = [
    ...Object.values(Examples).filter<typeof throwError>(
      (value): value is typeof throwError => typeof value === "function"
    ),
    throwError,
  ] as const;

  const expectedError = new Error();

  try {
    for (const test of tests) {
      await runTests(test, createNavigation());
      await runWrapperTests(test, createNavigation());
    }
  } catch (error) {
    caught = error;
  }

  return (given) => {
    if (given !== createNavigation)
      throw new Error("Expected same instance to be provided to assertion");
    if (caught) throw caught;
  };

  async function runWrapperTests(
    test: (navigation: Navigation) => unknown,
    localNavigation: unknown
  ) {
    assertNavigationLike(localNavigation);
    if (!localNavigation) throw new Error("Expected app history");
    const target = new NavigationNavigation(localNavigation);
    const proxied = new Proxy(localNavigation, {
      get(unknown: Navigation, p): any {
        if (isTargetKey(p)) {
          const value = target[p];
          if (typeof value === "function") {
            return value.bind(target);
          }
          return value;
        }
        return undefined;

        function isTargetKey(key: unknown): key is keyof typeof target {
          return (
            (typeof key === "string" || typeof key === "symbol") &&
            key in target
          );
        }
      },
    });
    return runTests(test, proxied);
  }

  async function runTests(
    test: (navigation: Navigation) => unknown,
    localNavigation: unknown
  ) {
    assertNavigationLike(localNavigation);

    localNavigation.addEventListener("navigate", (event) => {
      if (isWindowNavigation(localNavigation)) {
        // Add a default navigation to disable network features
        event.transitionWhile(Promise.resolve());
      }
    });

    // Add as very first currentchange listener, to allow location change to happen
    localNavigation.addEventListener("currentchange", (event) => {
      const { currentEntry } = localNavigation;
      if (!currentEntry) return;
      const state = currentEntry.getState<{ title?: string }>() ?? {};
      const { pathname } = new URL(
        currentEntry.url ?? "/",
        "https://example.com"
      );
      try {
        if (
          typeof window !== "undefined" &&
          typeof window.history !== "undefined" &&
          !isWindowNavigation(localNavigation)
        ) {
          window.history.pushState(state, state.title ?? "", pathname);
        }
      } catch (e) {
        console.warn("Failed to push state", e);
      }
      console.log(`Updated window pathname to ${pathname}`);
    });

    try {
      console.log("START ", test.name);
      await test(localNavigation);
      const finished = localNavigation.transition?.finished;
      if (finished) {
        await finished.catch((error) => void error);
      }

      // Let the events to finish logging
      if (typeof process !== "undefined" && process.nextTick) {
        await new Promise<void>(process.nextTick);
      } else {
        await new Promise<void>(queueMicrotask);
      }
      // await new Promise(resolve => setTimeout(resolve, 20));

      console.log("PASS  ", test.name);
    } catch (error) {
      if (error !== expectedError) {
        caught = caught || error;
        console.error("ERROR", test.name, error);
        if (!getConfig().FLAGS?.includes("CONTINUE_ON_ERROR")) {
          return;
        }
      } else {
        console.log("PASS  ", test.name);
      }
    }
  }

  async function throwError(navigation: Navigation): Promise<void> {
    throw expectedError;
  }
}

async function getPerformance(): Promise<
  Pick<typeof performance, "now"> | undefined
> {
  if (typeof performance !== "undefined") {
    return performance;
  }
  const { performance: nodePerformance } = await import("perf_hooks");
  return nodePerformance;
}

function assertNavigationLike(
  navigation: unknown
): asserts navigation is Navigation {
  function isLike(navigation: unknown): navigation is Partial<Navigation> {
    return !!navigation;
  }
  const is =
    isLike(navigation) &&
    typeof navigation.navigate === "function" &&
    typeof navigation.back === "function" &&
    typeof navigation.forward === "function";
  if (!is) throw new Error("Expected Navigation instance");
}
