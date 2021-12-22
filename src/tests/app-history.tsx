/* c8 ignore start */
import {
    AppHistory
} from "../app-history.prototype";
import * as Examples from "./examples";

export interface AppHistoryAssertFn {
    (given: unknown): asserts given is () => AppHistory
}

export async function assertAppHistory(createAppHistory: () => unknown): Promise<AppHistoryAssertFn> {
    let caught: unknown;

    const tests = [
            ...Object.values(Examples),
        throwError,
    ] as const

    const expectedError = new Error();

    try {
        for (const test of tests) {
            const localAppHistory = createAppHistory();
            assertAppHistoryLike(localAppHistory);

            // Add as very first currentchange listener, to allow location change to happen
            localAppHistory.addEventListener("currentchange", () => {
                const { current } = localAppHistory;
                if (!current) return;
                const state = current.getState<{ title?: string }>() ?? {};
                const { pathname } = new URL(current.url, "https://example.com");
                if (typeof window !== "undefined" && typeof window.history !== "undefined" && (
                    typeof appHistory === "undefined" ||
                    appHistory !== localAppHistory
                )) {
                    window.history.pushState(state, state.title ?? "", pathname);
                }
                console.log(`Updated window pathname to ${pathname}`);
            });


            try {
                console.log("START ", test.name);
                await test(localAppHistory);
                console.log("PASS  ", test.name);
            } catch (error) {
                if (error !== expectedError) {
                    caught = caught || error;
                    console.error("ERROR", test.name, error)
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

    async function throwError() {
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