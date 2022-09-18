declare module "uuid" {
  export function v4(): string;
}
declare module "https://deno.land/std@0.113.0/uuid/mod.ts" {
  export const v4: {
    generate(): string;
  };
}
declare module "deno:std/uuid/mod" {
  export const v4: {
    generate(): string;
  };
}
declare module "deno:std/uuid/v4" {
  export function generate(): string;
}
