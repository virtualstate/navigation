/* c8 ignore start */

const initialImportPath = getConfig()["@virtualstate/app-history/test/imported/path"] ?? "@virtualstate/app-history";

if (typeof initialImportPath !== "string") throw new Error("Expected string import path");

export const { AppHistory } = await import(initialImportPath);

export function getConfig() {
    return {
        ...getNodeConfig(),
    };
}

function getNodeConfig() {
    if (typeof process === "undefined") return {};
    return JSON.parse(process.env.TEST_CONFIG ?? "{}");
}
/* c8 ignore end */