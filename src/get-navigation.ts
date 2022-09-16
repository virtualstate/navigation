import { globalNavigation } from "./global-navigation";
import { Navigation } from "./navigation";

export function getNavigation() {
    return globalNavigation ?? new Navigation();
}