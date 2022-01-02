/* c8 ignore start */
import process from "./node-process";

export function getConfig(): Record<string, string> {
    return {
        ...getNodeConfig(),
    };
}

function getNodeConfig(): Record<string, string> {
    if (typeof process === "undefined") return {};
    return {
        FLAGS: process.env.FLAGS,
        ...JSON.parse(process.env.TEST_CONFIG ?? "{}")
    };
}