import { globalNavigation } from "./global-navigation";
import { getNavigation } from "./get-navigation";
import {applyPolyfill} from "./apply-polyfill";

const navigation = getNavigation();

if (
  navigation !== globalNavigation &&
  !globalNavigation &&
  typeof window !== "undefined"
) {
  await applyPolyfill({
    navigation
  })
}
