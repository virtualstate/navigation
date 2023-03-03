import { GlobalUUID } from "./global-uuid";
// import UUID from "uuid";
// async function importUUID() {
//     const { v4 } = await import("uuid");
//     return v4;
// }

if (!GlobalUUID) {
  console.error("Expected crypto.randomUUID to be available");
}

export const v4 = GlobalUUID; //await importUUID();
