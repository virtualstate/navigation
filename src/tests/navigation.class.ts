import { Navigation } from "../navigation";
import { NavigationAssertFn, assertNavigation } from "./navigation";

function getNavigationByClass() {
    return new Navigation();
}
const fn: NavigationAssertFn = await assertNavigation(getNavigationByClass);
fn(getNavigationByClass);
console.log("PASS assertNavigation:local:new Navigation");
