import {AppHistoryAssertFn, assertAppHistory} from "./app-history";
import { importPath } from "./imported";

const { AppHistory } = await import(importPath);
const input = () => new AppHistory();
const fn: AppHistoryAssertFn = await assertAppHistory(input);
fn(input);
console.log(`PASS assertAppHistory:${importPath}:new AppHistory`);