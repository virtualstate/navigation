import {
  Navigation,
  NavigationEventMap,
  NavigationHistoryEntry,
  NavigationNavigateOptions,
  NavigationNavigationOptions,
  NavigationReloadOptions,
  NavigationResult,
  NavigationUpdateCurrentOptions,
} from "./spec/navigation";
import { NavigationEventTarget } from "./navigation-event-target";

class NoOperationNavigationResult implements NavigationResult {
  committed: Promise<NavigationHistoryEntry> = new Promise(() => {});
  finished: Promise<NavigationHistoryEntry> = new Promise(() => {});
}

export class NoOperationNavigation<S = unknown>
  extends NavigationEventTarget<NavigationEventMap>
  implements Navigation<S>
{
  readonly canGoBack: boolean = false;
  readonly canGoForward: boolean = false;

  back(options?: NavigationNavigationOptions): NavigationResult {
    return new NoOperationNavigationResult();
  }

  entries(): NavigationHistoryEntry[] {
    return [];
  }

  forward(options?: NavigationNavigationOptions): NavigationResult {
    return new NoOperationNavigationResult();
  }

  traverseTo(key: string, options?: NavigationNavigationOptions): NavigationResult {
    return new NoOperationNavigationResult();
  }

  navigate(url: string, options?: NavigationNavigateOptions): NavigationResult {
    return new NoOperationNavigationResult();
  }

  reload(options?: NavigationReloadOptions): NavigationResult {
    return new NoOperationNavigationResult();
  }

  updateCurrentEntry(options: NavigationUpdateCurrentOptions): Promise<void>;
  updateCurrentEntry(options: NavigationUpdateCurrentOptions): void;
  async updateCurrentEntry(
    options: NavigationUpdateCurrentOptions
  ): Promise<void> {
    return undefined;
  }
}
