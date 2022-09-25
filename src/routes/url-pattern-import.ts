import { URLPattern as polyfillURLPattern } from "urlpattern-polyfill";
import { globalURLPattern } from "./url-pattern-global";

export { URLPatternInit } from "./url-pattern-global";

export class URLPattern extends (globalURLPattern ?? polyfillURLPattern) {

}