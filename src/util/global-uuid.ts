interface DocumentedRandomUUID {
  randomUUID(): string;
}

export const GlobalUUID = isRandomUUID(crypto)
  ? (
      (crypto: DocumentedRandomUUID) => () =>
        crypto.randomUUID()
    )(crypto)
  : undefined;

function isRandomUUID(value: unknown): value is DocumentedRandomUUID {
  function isLike(value: unknown): value is Partial<DocumentedRandomUUID> {
    return typeof value !== "undefined";
  }
  return isLike(value) && typeof value.randomUUID === "function";
}
