const THIS_WILL_BE_REMOVED = "This will be removed when version 1.0.0 of @virtualstate/navigation is published"

const WARNINGS = {
    EVENT_INTERCEPT_HANDLER: `You are using a non standard interface, please update your code to use event.intercept({ async handler() {} })\n${THIS_WILL_BE_REMOVED}`
} as const;

type WarningKey = keyof typeof WARNINGS;

let GLOBAL_IS_WARNINGS_IGNORED: boolean = false;
let GLOBAL_IS_WARNINGS_TRACED: boolean = true;

export function setIgnoreWarnings(ignore: boolean) {
    GLOBAL_IS_WARNINGS_IGNORED = ignore;
}

export function setTraceWarnings(ignore: boolean) {
    GLOBAL_IS_WARNINGS_TRACED = ignore;
}

export function logWarning(warning: WarningKey,...message: unknown[]) {
    if (GLOBAL_IS_WARNINGS_IGNORED) {
        return;
    }
    try {
        if (GLOBAL_IS_WARNINGS_TRACED) {
            console.trace(WARNINGS[warning], ...message);
        } else {
            console.warn(WARNINGS[warning], ...message);
        }
    } catch {
        // We don't want attempts to log causing issues
        // maybe we don't have a console
    }
}