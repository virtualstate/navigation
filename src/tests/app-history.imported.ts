import {AppHistoryAssertFn, assertAppHistory} from "./app-history";
import {getConfig} from "./config";

/* c8 ignore next */
const importPath = getConfig()["@virtualstate/app-history/test/imported/path"] ?? "@virtualstate/app-history";

/* c8 ignore next */
if (typeof importPath !== "string") throw new Error("Expected string import path");

const { AppHistory } = await import(importPath)
    /* c8 ignore start */
    .catch(() => {
        console.warn(
            `Could not import ${importPath}, if this is a module, please specify it in an importmap, or your package.json dependencies`
        );
        return import("../app-history");
    });
    /* c8 ignore end */

const input = () => new AppHistory();
const fn: AppHistoryAssertFn = await assertAppHistory(input);
fn(input);
console.log(`PASS assertAppHistory:${importPath}:new AppHistory`);