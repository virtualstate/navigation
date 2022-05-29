import { GlobalUUID } from "./global-uuid";

async function importUUID() {
    const { v4 } = await import("uuid");
    return v4;
}

export const v4 = GlobalUUID ?? await importUUID();