import { GlobalAbortController } from "./global-abort-controller";

if (!GlobalAbortController) {
  throw new Error("AbortController expected to be available or polyfilled");
}

export const AbortController = GlobalAbortController;