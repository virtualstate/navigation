import {getEnvironmentConfig} from "@opennetwork/environment";

export function getConfig(): Record<string, unknown> {
    return {
        ...getNodeConfig(),
        ...getCaughtEnvironmentConfig(),
    };
}

function getCaughtEnvironmentConfig(): Record<string, unknown> {
    try {
        return getEnvironmentConfig();
    } catch {
        return {};
    }
}

function getNodeConfig(): Record<string, unknown> {
    if (typeof process === "undefined") return {};
    return JSON.parse(process.env.TEST_CONFIG ?? "{}");
}