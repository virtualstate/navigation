import {getEnvironmentConfig} from "@opennetwork/environment";

export function getConfig(): Record<string, unknown> {
    try {
        return getEnvironmentConfig();
    } catch {
        return {};
    }
}