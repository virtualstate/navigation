import { GlobalUUID } from "./global-uuid";
import UUID from "uuid";
// async function importUUID() {
//     const { v4 } = await import("uuid");
//     return v4;
// }

export const v4 = GlobalUUID ?? UUID.v4; //await importUUID();