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
            const appHistory = createAppHistory();
            assertAppHistoryLike(appHistory);
            try {
                console.log("START ", test);
                await test(appHistory);
                console.log("PASS  ", test);
            } catch (error) {
                if (error !== expectedError) {
                    caught = caught || error;
                    console.error("ERROR", test, error)
                } else {
                    console.log("PASS  ", test);
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