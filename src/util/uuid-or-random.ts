export const { v4 } = await import("./import-uuid")
    .catch(() => undefined)
    .then((mod) => mod ?? ({ v4(): string {
        return `0101010-0101010-${Math.random()}`.replace(".", "");
    }}));