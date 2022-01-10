/* c8 ignore start */
import {
    AppHistory
} from "../spec/app-history";
import * as Examples from "./examples";
import {getConfig} from "./config";
import {isWindowAppHistory} from "./util";

export interface AppHistoryAssertFn {
    (given: unknown): asserts given is () => AppHistory
}

declare global {
    interface History {
        pushState(data: unknown, unused: string, url?: string | URL): void;
    }
    interface AppHistory {
    }
    interface Window {
        readonly history: History;
        readonly appHistory: AppHistory;
    }
}

export async function assertAppHistory(createAppHistory: () => unknown): Promise<AppHistoryAssertFn> {
    let caught: unknown;

    const tests = [
            ...Object.values(Examples)
                .filter<typeof throwError>((value): value is typeof throwError => typeof value === "function"),
        throwError,
    ] as const

    const expectedError = new Error();

    try {
        for (const test of tests) {
            const localAppHistory = createAppHistory();
            assertAppHistoryLike(localAppHistory);

            localAppHistory.addEventListener("navigate", (event) => {
                if (isWindowAppHistory(localAppHistory)) {
                    // Add a default navigation to disable network features
                    event.transitionWhile(Promise.resolve());
                }
            })

            // Add as very first currentchange listener, to allow location change to happen
            localAppHistory.addEventListener("currentchange", (event) => {
                const { current } = localAppHistory;
                if (!current) return;
                const state = current.getState<{ title?: string }>() ?? {};
                const { pathname } = new URL(current.url ?? "/", "https://example.com");
                try {
                    if (typeof window !== "undefined" && typeof window.history !== "undefined" && !isWindowAppHistory(localAppHistory)) {
                        window.history.pushState(state, state.title ?? "", pathname);
                    }
                } catch (e) {
                    console.warn("Failed to push state", e);
                }
                console.log(`Updated window pathname to ${pathname}`);
            });


            try {
                console.log("START ", test.name);
                await test(localAppHistory);
                const finished = localAppHistory.transition?.finished;
                if (finished) {
                    await finished.catch(error => void error);
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
                        break;
                    }
                } else {
                    console.log("PASS  ", test.name);
                }
            }
        }
    } catch (error) {
        caught = error;
    }

    return (given) => {
        if (given !== createAppHistory) throw new Error("Expected same instance to be provided to assertion");
        if (caught) throw caught;
    }

    async function throwError(appHistory: AppHistory): Promise<void> {
        throw expectedError;
    }
}

async function getPerformance(): Promise<Pick<typeof performance, "now"> | undefined> {
    if (typeof performance !== "undefined") {
        return performance;
    }
    const { performance: nodePerformance } = await import("perf_hooks");
    return nodePerformance;
}

function assertAppHistoryLike(appHistory: unknown): asserts appHistory is AppHistory {
    function isLike(appHistory: unknown): appHistory is Partial<AppHistory> {
        return !!appHistory;
    }
    const is = (
        isLike(appHistory) &&
        typeof appHistory.navigate === "function" &&
        typeof appHistory.back === "function" &&
        typeof appHistory.forward === "function"
    );
    if (!is) throw new Error("Expected AppHistory instance");
}