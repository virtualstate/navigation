import {AppHistory} from "../app-history";
import {AppHistoryAssertFn, assertAppHistory} from "./app-history";

const input = () => new AppHistory();
const fn: AppHistoryAssertFn = await assertAppHistory(input);
fn(input);
console.log("PASS assertAppHistory:new AppHistory");