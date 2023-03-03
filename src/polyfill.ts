import { getNavigation } from "./get-navigation";
import { applyPolyfill, shouldApplyPolyfill } from "./apply-polyfill";

const navigation = getNavigation();

if (shouldApplyPolyfill(navigation)) {
  try {
    applyPolyfill({
      navigation
    });
    console.log("Polyfill applied automatically");
    console.log(navigation);
  } catch (error) {
    console.error("Failed to apply polyfill");
    console.error(error);
  }
}