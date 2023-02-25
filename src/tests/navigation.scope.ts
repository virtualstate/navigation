/* c8 ignore start */
import { NavigationAssertFn, assertNavigation } from "./navigation";
import { Navigation } from "../spec/navigation";

declare var navigation: Navigation;

if (typeof navigation !== "undefined") {
  try {
    function getNavigationByScope() {
      return navigation;
    }
    const fn: NavigationAssertFn = await assertNavigation(getNavigationByScope);
    fn(getNavigationByScope);
    console.log("PASS assertNavigation:scope:new Navigation");
  } catch (error) {
    console.log("FAIL assertNavigation:scope:new Navigation");
    throw error;
  }
}

export default 1;
