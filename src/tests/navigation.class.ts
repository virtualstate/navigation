import {Navigation} from "../navigation";
import {NavigationAssertFn, assertNavigation} from "./navigation";

const input = () => new Navigation();
const fn: NavigationAssertFn = await assertNavigation(input);
fn(input);
console.log("PASS assertNavigation:local:new Navigation");