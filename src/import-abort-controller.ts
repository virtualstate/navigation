import { GlobalAbortController } from "./global-abort-controller";
// import ImportedAbortController from "abort-controller";

// async function importAbortController() {
//     const { default: AbortController } = await import("abort-controller");
//     return AbortController;
// }

if (!GlobalAbortController) {
  throw new Error("AbortController expected to be available or polyfilled");
}

export const AbortController = GlobalAbortController; // await importAbortController();
