/* c8 ignore start */
import { NavigationAssertFn, assertNavigation } from "./navigation";
import { Navigation } from "../spec/navigation";

declare var navigation: Navigation;

if (typeof navigation !== "undefined") {
  try {
    const input = () => navigation;
    const fn: NavigationAssertFn = await assertNavigation(input);
    fn(input);
    console.log("PASS assertNavigation:scope:new Navigation");
  } catch (error) {
    console.log("FAIL assertNavigation:scope:new Navigation");
    throw error;
  }
}

export default 1;
