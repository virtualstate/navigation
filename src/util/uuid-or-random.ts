export const { v4 } = await import("./import-uuid")
  .catch(async () => {
    const crypto = await import("node:crypto");
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
      mod ?? {
        v4(): string {
          return Array
              .from(
                  { length: 5 },
                  () => `${Math.random()}`
              )
              .join("-")
              .replace(".", "");
        },
      }
  );
