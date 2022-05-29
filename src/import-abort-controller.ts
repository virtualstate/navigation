import { GlobalAbortController } from "./global-abort-controller";

async function importAbortController() {
    const { default: AbortController } = await import("abort-controller");
    return AbortController;
}

export const AbortController = GlobalAbortController ?? await importAbortController();