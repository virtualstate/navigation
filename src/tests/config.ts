/* c8 ignore start */
export function getConfig(): Record<string, unknown> {
    return {
        ...getNodeConfig(),
    };
}

function getNodeConfig(): Record<string, unknown> {
    if (typeof process === "undefined") return {};
    return JSON.parse(process.env.TEST_CONFIG ?? "{}");
}