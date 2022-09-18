import { GlobalUUID } from "./global-uuid";
// import UUID from "uuid";
// async function importUUID() {
//     const { v4 } = await import("uuid");
//     return v4;
// }

if (!GlobalUUID) {
  throw new Error("Expected crypto.randomUUID to be available or polyfilled");
}

export const v4 = GlobalUUID; //await importUUID();
