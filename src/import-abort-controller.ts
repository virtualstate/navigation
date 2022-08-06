import { GlobalAbortController } from "./global-abort-controller";
import ImportedAbortController from "abort-controller";

// async function importAbortController() {
//     const { default: AbortController } = await import("abort-controller");
//     return AbortController;
// }

export const AbortController = GlobalAbortController ?? ImportedAbortController; // await importAbortController();