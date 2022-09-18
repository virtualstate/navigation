import { DOMParser } from "deno:deno_dom/deno-dom-wasm.ts";

export async function parseDOM(input: string, querySelector: string) {
  const doc = new DOMParser().parseFromString(input, "text/html");
  if (!doc) {
    throw new Error("Expected valid document");
  }
  const element = doc.querySelector(querySelector);
  if (!element) {
    throw new Error("Expected elemenet");
  }
  return {
    title: doc.title,
    innerHTML: element.innerHTML,
  } as const;
}
