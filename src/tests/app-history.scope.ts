/* c8 ignore start */
import {AppHistoryAssertFn, assertAppHistory} from "./app-history";

if (typeof appHistory !== "undefined") {
    try {
        const input = () => appHistory;
        const fn: AppHistoryAssertFn = await assertAppHistory(input);
        fn(input);
        console.log("PASS assertAppHistory:scope:new AppHistory");
    } catch (error) {
        console.log("FAIL assertAppHistory:scope:new AppHistory");
        throw error;
    }
}

export default 1;