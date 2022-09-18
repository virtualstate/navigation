declare module "deno:deno_dom/deno-dom-wasm.ts" {
  export class DOMParser {
    parseFromString(input: string, type: string): Document | undefined;
  }
}
