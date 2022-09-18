import { generate } from "deno:std/uuid/v4";

export function v4() {
  return generate();
}

export default { v4 };
