declare module "@ungap/structured-clone/json" {
  export const stringify: (x: any) => string
  export const parse: (x: string) => any
}