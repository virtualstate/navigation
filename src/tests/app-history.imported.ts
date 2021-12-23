import {AppHistoryAssertFn, assertAppHistory} from "./app-history";

try {
    const { AppHistory } = (await import("@virtualstate/app-history-imported")) ?? { AppHistory: undefined };
    if (AppHistory) {
        const input = () => new AppHistory();
        const fn: AppHistoryAssertFn = await assertAppHistory(input);
        fn(input);
        console.log(`PASS assertAppHistory:imported:new AppHistory`);
    }
} catch {
    console.warn(`WARN FAILED assertAppHistory:imported:new AppHistory`);
}