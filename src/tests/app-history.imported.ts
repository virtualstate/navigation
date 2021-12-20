import {AppHistoryAssertFn, assertAppHistory} from "./app-history";
import {getConfig} from "./config";

const importPath = getConfig()["@virtualstate/app-history/test/imported/path"] ?? "@virtualstate/app-history";

if (typeof importPath !== "string") throw new Error("Expected string import path");

const { AppHistory } = await import(importPath)
    .catch(() => {
        console.warn(
            `Could not import ${importPath}, if this is a module, please specify it in an importmap, or your package.json dependencies`
        );
        return import("../app-history");
    });

const input = () => new AppHistory();
const fn: AppHistoryAssertFn = await assertAppHistory(input);
fn(input);
console.log("PASS assertAppHistory:import:new AppHistory");