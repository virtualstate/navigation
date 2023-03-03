import { getNavigation } from "./get-navigation";
import { applyPolyfill, shouldApplyPolyfill } from "./apply-polyfill";

const navigation = getNavigation();

if (shouldApplyPolyfill(navigation)) {
  await applyPolyfill({
    navigation
  })
}