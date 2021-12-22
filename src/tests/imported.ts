/* c8 ignore start */
import {getConfig} from "./config";

const initialImportPath = getConfig()["@virtualstate/app-history/test/imported/path"] ?? "@virtualstate/app-history";

if (typeof initialImportPath !== "string") throw new Error("Expected string import path");

export const importPath = await import(initialImportPath)
    .then(() => initialImportPath)
    /* c8 ignore start */
    .catch(() => {
        console.warn(
            `Could not import ${initialImportPath}, if this is a module, please specify it in an importmap, or your package.json dependencies`
        );
        return "../app-history";
    });
/* c8 ignore end */