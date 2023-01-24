declare module "@ungap/structured-clone/json" {
  export const stringify: typeof JSON["stringify"]
  export const parse: typeof JSON["parse"]
}