
const fakeUUID = {
    v4(): string {
        return Array
            .from(
                { length: 5 },
                () => `${Math.random()}`.replace(/^0\./, "")
            )
            .join("-")
            .replace(".", "");
    },
}

async function getImportUUIDOrNodeRandomUUID() {
    const { v4 } = await import("./import-uuid")
        .catch(async () => {
            // @ts-ignore
            const crypto: Crypto = await import("node:crypto");
            return {
                v4() {
                    return crypto.randomUUID()
                }
            }
        })
        .catch(async () => import("uuid"))
        .catch(() => undefined)
        .then(
            (mod) =>
                mod ?? fakeUUID
        );
    return { v4 };
}

/** post rollup replace importUuid **/
const uuidModule = (
    await getImportUUIDOrNodeRandomUUID()
);
const getUuidModule = () => uuidModule;
/** post rollup replace importUuid **/

export function v4() {
    const uuidModule = getUuidModule();
    if (!(uuidModule?.v4)) return fakeUUID.v4();
    return uuidModule.v4();
}