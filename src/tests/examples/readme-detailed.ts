import { ok, assert, isWindowNavigation } from "../util";
import {
  Navigation,
  NavigationCurrentEntryChangeEvent,
  NavigationDestination,
  NavigationHistoryEntry,
  NavigateEvent,
} from "../../spec/navigation";
import { AsyncEventTarget as EventTarget, Event } from "../../event-target";
import { FetchEvent, fetch } from "./fetch";
import {
  addEventListener,
  removeEventListener,
} from "../../event-target/global";
import { Response } from "@opennetwork/http-representation";
import { deferred } from "../../util/deferred";

export async function initialNavigateThenBack(navigation: Navigation) {
  let navigateCalled = false,
    currentEntryChangeCalled = false;
  navigation.addEventListener(
    "navigate",
    (event) => {
      navigateCalled = true;
      event.intercept(new Promise<void>(queueMicrotask));
    },
    { once: true }
  );
  navigation.addEventListener("currententrychange", () => {
    currentEntryChangeCalled = true;
  });
  const { committed, finished } = navigation.navigate("/test", {
    state: {
      value: 1,
    },
  });

  // These are called sync after navigate is called no matter what
  assert<true>(navigateCalled);
  assert<true>(currentEntryChangeCalled);

  // This ties in the async update requirement
  const updatedCurrent = navigation.currentEntry;
  assert<NavigationHistoryEntry>(updatedCurrent);
  ok(updatedCurrent.getState<{ value: 1 }>().value === 1);

  const committedEntry = await committed;
  const finishedEntry = await finished;

  ok(updatedCurrent === navigation.currentEntry);
  ok(finishedEntry === navigation.currentEntry);
  ok(committedEntry === finishedEntry);
  //
  // if (!isWindowNavigation(navigation)) {
  //     let caught;
  //     if (!navigation.canGoBack) {
  //         try {
  //             await navigation.back();
  //         } catch (error) {
  //             // No initial back
  //             caught = error;
  //         }
  //     }
  //     assert(caught);
  // }
}

export async function initialNavigateThenBackAssigned(navigation: Navigation) {
  let navigateCalled = false,
      currentEntryChangeCalled = false;
  navigation.onnavigate = (event) => {
    navigateCalled = true;
    event.intercept(new Promise<void>(queueMicrotask));
  };
  navigation.oncurrententrychange = () => {
    currentEntryChangeCalled = true;
  };
  const { committed, finished } = navigation.navigate("/test", {
    state: {
      value: 1,
    },
  });

  // These are called sync after navigate is called no matter what
  assert<true>(navigateCalled);
  assert<true>(currentEntryChangeCalled);

  // This ties in the async update requirement
  const updatedCurrent = navigation.currentEntry;
  assert<NavigationHistoryEntry>(updatedCurrent);
  ok(updatedCurrent.getState<{ value: 1 }>().value === 1);

  const committedEntry = await committed;
  const finishedEntry = await finished;

  ok(updatedCurrent === navigation.currentEntry);
  ok(finishedEntry === navigation.currentEntry);
  ok(committedEntry === finishedEntry);

  if (!isWindowNavigation(navigation)) {
    let caught;
    if (!navigation.canGoBack) {
      try {
        await navigation.back();
      } catch (error) {
        // No initial back
        caught = error;
      }
    }
    assert(caught);
  }
}

export async function routeHandlerExample(navigation: Navigation) {
  const routesTable = new Map<string, () => Promise<void>>();

  function handler(event: NavigateEvent) {
    if (!event.canIntercept || event.hashChange) {
      return;
    }
    const url = pathname(event.destination.url);
    if (routesTable.has(url)) {
      const routeHandler = routesTable.get(url);
      if (!routeHandler) return;
      event.intercept(routeHandler);
    }
  }
  navigation.addEventListener("navigate", handler);
  try {
    let indexed = 0;
    routesTable.set("/test", async () => {
      indexed += 1;
    });
    const { finished } = navigation.navigate("/test", {
      state: {
        value: 1,
      },
    });
    await finished;
    ok(indexed);
  } finally {
    navigation.removeEventListener("navigate", handler);
  }
}

export async function productBackButtonClicked(navigation: Navigation) {
  const backButtonEl = new EventTarget();

  let finishedClickNavigation = deferred<unknown>();

  const startingLength = isWindowNavigation(navigation)
    ? navigation.entries().length
    : 0;

  backButtonEl.addEventListener("click", async () => {
    const nextIndex = (navigation.currentEntry?.index ?? -2) - 1;
    const previous =
      nextIndex < startingLength ? undefined : navigation.entries()[nextIndex];
    // console.log({ previous });
    if (previous?.url === "/product-listing") {
      // console.log("Back");
      const { finished } = navigation.back();
      finishedClickNavigation.resolve(finished);
      await finished;
    } else {
      // console.log("Navigate replace");
      // If the user arrived here by typing the URL directly:
      const { finished } = navigation.navigate("/product-listing", {
        history: "replace",
      });
      finishedClickNavigation.resolve(finished);
      await finished;
    }
  });

  ok(navigation.entries().length === startingLength);

  await backButtonEl.dispatchEvent({
    type: "click",
  });

  await finishedClickNavigation.promise;
  finishedClickNavigation = deferred();

  ok(pathname(navigation.currentEntry?.url) === "/product-listing");
  if (isWindowNavigation(navigation)) {
    // We would have replaced the initial!
    ok(navigation.entries().length === startingLength);
  } else {
    // Else for non spec we will have our first navigation
    ok(navigation.entries().length === 1);
  }

  const { finished } = await navigation.navigate("/product-listing/product");
  await finished;

  ok(pathname(navigation.currentEntry?.url) === "/product-listing/product");
  if (isWindowNavigation(navigation)) {
    // We should have navigated here, so increase the count
    ok(navigation.entries().length === startingLength + 1);
  } else {
    ok(navigation.entries().length === 2);
  }

  await backButtonEl.dispatchEvent({
    type: "click",
  });

  await finishedClickNavigation.promise;
  finishedClickNavigation = deferred();

  // console.log(navigation.entries());

  ok(pathname(navigation.currentEntry?.url) === "/product-listing");
  // We should have gone back here, length should have stayed the same
  if (isWindowNavigation(navigation)) {
    ok(navigation.entries().length === startingLength + 1);
  } else {
    ok(navigation.entries().length === 2);
  }
}

export async function performanceExample(navigation: Navigation) {
  // const performance = await getPerformance();
  //
  // for (const entry of performance?.getEntriesByType("same-document-navigation")) {
  //     console.log(`It took ${entry.duration} ms to navigate to the URL ${entry.name}`);
  // }
}

export async function currentReloadExample(navigation: Navigation) {
  await navigation.navigate("/").finished;
  await navigation.reload({
    state: { ...navigation.currentEntry?.getState<{}>(), test: 3 },
  }).finished;
  ok(navigation.currentEntry?.getState<{ test: number }>().test === 3);
}

export async function currentEntryChangeExample(navigation: Navigation) {
  let changedEvent!: NavigationCurrentEntryChangeEvent;
  navigation.addEventListener("currententrychange", (event) => {
    changedEvent = event;
  });
  ok(navigation.currentEntry);
  await navigation.navigate("/").finished;
  assert<NavigationCurrentEntryChangeEvent>(changedEvent);
  ok(changedEvent.navigationType);
  ok(changedEvent.from);
  const initial = navigation.currentEntry;
  assert<NavigationHistoryEntry>(initial);
  await navigation.navigate("/1").finished;
  assert<NavigationCurrentEntryChangeEvent>(changedEvent);
  ok(changedEvent.navigationType);
  assert<NavigationHistoryEntry>(changedEvent.from);
  ok(changedEvent.from.id === initial.id);
}

export async function homepageGoToExample(navigation: Navigation) {
  const homeButton = new EventTarget();

  await navigation.navigate("/home").finished;
  const homepageKey = navigation.currentEntry?.key;
  assert<string>(homepageKey);

  homeButton.addEventListener("click", async () => {
    await navigation.traverseTo(homepageKey).finished;
  });

  await navigation.navigate("/other").finished;
  ok(pathname(navigation.currentEntry?.url) === "/other");

  await homeButton.dispatchEvent({
    type: "click",
  });

  ok(pathname(navigation.currentEntry?.url) === "/home");
}

export async function toggleExample(navigation: Navigation) {
  await navigation.navigate("/").finished;

  interface State {
    detailsOpen?: boolean;
  }

  const detailsElement: EventTarget & { open?: boolean } = new EventTarget();
  detailsElement.addEventListener("toggle", async () => {
    const state = navigation.currentEntry?.getState<State>();
    await navigation.updateCurrentEntry({
      state: {
        ...state,
        detailsOpen: detailsElement.open ?? !state?.detailsOpen,
      },
    });
  });

  ok(!navigation.currentEntry?.getState<State>()?.detailsOpen);

  await detailsElement.dispatchEvent({
    type: "toggle",
  });

  ok(navigation.currentEntry?.getState<State>().detailsOpen === true);

  await detailsElement.dispatchEvent({
    type: "toggle",
  });

  ok(navigation.currentEntry?.getState<State>().detailsOpen === false);
}

export async function perEntryEventsExample(navigation: Navigation) {
  if (isWindowNavigation(navigation)) return; // navigatefrom + navigateto not yet available

  async function showPhoto(photoId: number | string) {
    interface State {
      dateTaken?: string;
      caption?: string;
    }

    const { committed, finished } = navigation.navigate(`/photos/${photoId}`, {
      state: {},
    });

    // In our app, the `navigate` handler will take care of actually showing the photo and updating the content area.
    const entry = await committed;

    const updateCurrentEntryFinished = deferred<unknown>();

    // When we navigate away from this photo, save any changes the user made.
    entry.addEventListener(
      "navigatefrom",
      async () => {
        console.log("navigatefrom");
        const result = navigation.updateCurrentEntry({
          state: {
            dateTaken: new Date().toISOString(),
            caption: `Photo taken on the date ${new Date().toDateString()}`,
          },
        });
        // Just ensure committed before we move on
        // We know that this will be applied at a minimum
        updateCurrentEntryFinished.resolve(result);
      },
      { once: true }
    );

    let navigateBackToState!: State;

    // If we ever navigate back to this photo, e.g. using the browser back button or
    // navigation.traverseTo(), restore the input values.
    entry.addEventListener("navigateto", () => {
      const next = navigation.currentEntry?.getState<State>();
      if (next) {
        navigateBackToState = next;
      }
    });

    await finished;

    // Trigger navigatefrom
    await navigation.navigate("/").finished;

    assert(updateCurrentEntryFinished);
    await updateCurrentEntryFinished.promise;

    ok(updateCurrentEntryFinished);
    await updateCurrentEntryFinished;

    // Trigger naviagateto
    await navigation.traverseTo(entry.key).finished;

    assert(navigation.currentEntry?.key === entry.key);

    const finalState = navigation.currentEntry?.getState<State>();

    console.log(finalState);
    console.log({
      finalState,
      navigateBackToState,
      current: navigation.currentEntry,
    });

    assert<State>(navigateBackToState);
    ok(navigateBackToState.dateTaken);
    ok(navigateBackToState.caption);

    assert<State>(finalState);
    assert<State>(navigateBackToState);
    ok(finalState.dateTaken === navigateBackToState.dateTaken);
    ok(finalState.caption === navigateBackToState.caption);
  }
  // console.log("-----");
  await showPhoto("1");
}

export async function disposeExample(navigation: Navigation) {
  await navigation.navigate("/").finished;

  const startingKey = navigation.currentEntry?.key;

  assert<string>(startingKey);

  const values: (1 | 2 | 3)[] = [];
  assert(values);
  console.log(JSON.stringify({ 0: values }));

  const { committed: entry1Committed, finished: entry1Finished } =
    navigation.navigate("/1");
  const entry1 = await entry1Committed;
  entry1.addEventListener("dispose", () => values.push(1));
  const entry1Disposed = new Promise((resolve) =>
    entry1.addEventListener("dispose", resolve, { once: true })
  );
  await entry1Finished;

  const { committed: entry2Committed, finished: entry2Finished } =
    navigation.navigate("/2");
  const entry2 = await entry2Committed;
  const entry2Disposed = new Promise((resolve) =>
    entry2.addEventListener("dispose", resolve, { once: true })
  );
  entry2.addEventListener("dispose", () => values.push(2));

  await entry2Finished;

  const { committed: entry3Committed, finished: entry3Finished } =
    await navigation.navigate("/3");
  const entry3 = await entry3Committed;
  const entry3Disposed = new Promise((resolve) =>
    entry3.addEventListener("dispose", resolve, { once: true })
  );
  entry3.addEventListener("dispose", () => values.push(3));
  await entry3Finished;

  await navigation.traverseTo(startingKey).finished;
  await navigation.navigate("/1-b").finished;

  await Promise.all([entry1Disposed, entry2Disposed, entry3Disposed]);

  // console.log(JSON.stringify({ 3: values, entries: navigation.entries() }));

  ok(values.includes(1));
  ok(values.includes(2));
  ok(values.includes(3));
  console.log(JSON.stringify(values));
}

export async function currentEntryChangeMonitoringExample(navigation: Navigation) {
  navigation.addEventListener("currententrychange", () => {
    navigation.currentEntry?.addEventListener("dispose", genericDisposeHandler);
  });

  let disposedCount = 0;

  function genericDisposeHandler() {
    disposedCount += 1;
  }

  await navigation.navigate("/").finished;

  ok(!disposedCount);
  await navigation.navigate("/1").finished;
  ok(!disposedCount);
  await navigation.navigate("/2").finished;
  ok(!disposedCount);

  // Dispose first
  await navigation.navigate("/", { history: "replace" }).finished;
  // Dispose Second
  await navigation.navigate("/", { history: "replace" }).finished;
  // Should be back at start

  ok(disposedCount === 2);
}

export async function rollbackExample(navigation: Navigation) {
  if (isWindowNavigation(navigation)) return; // Does not work as expected

  const expectedError = `Error.${Math.random()}`;
  const toasts: string[] = [];

  function showErrorToast(message: string) {
    toasts.push(message);
  }

  // rollback is automatically triggered on error
  // let navigateErrorTransitionFinished = deferred<unknown>(),
  //     navigateErrorTransitionCommitted = deferred<unknown>();
  let navigateError = deferred();

  navigation.addEventListener("navigateerror", (e) => {
    navigateError.resolve();
    showErrorToast(`Could not load: ${e.message}`);
  });

  // Should be successful, no failing navigator yet
  await navigation.navigate("/").finished;

  ok(!toasts.length);

  const expectedRollbackState = await navigation.navigate(`/${Math.random()}`)
    .finished;

  ok(!toasts.length);

  // Reject after committed using currententrychange, or before committed using navigate
  navigation.addEventListener(
    "navigate",
    (event) => {
      event.intercept(Promise.reject(new Error(expectedError)));
    },
    { once: true }
  );

  // This should fail

  const errorUrl = `/thisWillError/${Math.random()}`;

  const { committed, finished } = navigation.navigate(errorUrl);

  // rollback is automatically triggered on error
  // await navigateErrorTransitionCommitted.promise;
  // await navigateErrorTransitionFinished.promise;

  await navigateError.promise;

  const [committedEntry, finishedError] = await Promise.all([
    committed,
    finished.catch((error) => error),
  ]);

  // console.log({
  //     committedEntry,
  //     finishedError
  // });
  assert<NavigationHistoryEntry>(committedEntry);

  assert<Error>(finishedError);
  assert(finishedError instanceof Error);
  assert(finishedError.message === expectedError);

  ok(navigation.currentEntry);

  console.log({
    current: navigation.currentEntry.url,
    expectedRollbackState: expectedRollbackState.url,
    toasts,
  });

  ok(
    pathname(navigation.currentEntry?.url) ===
      pathname(expectedRollbackState.url)
  );

  console.log({ toasts });

  ok(toasts.length);
  ok(toasts[0].includes(expectedError));
}

export async function singlePageAppRedirectsAndGuards(navigation: Navigation) {
  if (isWindowNavigation(navigation)) {
    // TODO WARN investigate
    return;
  }

  function determineAction(destination: NavigationDestination): {
    type: string;
    destinationURL: string;
    destinationState: unknown;
    disallowReason?: string;
  } {
    const { pathname, searchParams } = new URL(
      destination.url,
      "https://example.com"
    );
    const destinationState: Record<string, unknown> = {
      ...destination.getState<{}>(),
    };
    searchParams.forEach(
      ([key, value]) => (destinationState[key] = destinationState[key] ?? value)
    );
    const type =
      (
        {
          "/redirect": "redirect",
          "/disallow": "disallow",
        } as const
      )[pathname] ?? "pass";

    console.log({ pathname, type });

    // console.log({ type, destination });
    return {
      type,
      destinationURL:
        (type === "redirect" && searchParams.get("target")) || destination.url,
      destinationState,
      disallowReason:
        type === "disallow"
          ? searchParams.get("reason") ?? undefined
          : undefined,
    };
  }

  let allowCount = 0;
  let disallowCount = 0;

  // TODO replace with transition usage
  let redirectFinished: Promise<NavigationHistoryEntry> | undefined = undefined;
  const seen = new WeakSet();
  navigation.addEventListener("navigate", (e) => {
    if (seen.has(e) || seen.has(e.intercept)) {
      console.log(e, seen.has(e), seen.has(e.intercept));
      // throw new Error("Seen event multiple times");
    }
    console.log("Adding");
    seen.add(e);
    seen.add(e.intercept);
    e.intercept(
      async () => {
        const result = determineAction(e.destination);

        if (result.type === "redirect") {
          if (isWindowNavigation(navigation)) {
            e.preventDefault();
          }
          console.log("Redirecting");
          redirectFinished = navigation.transition
            ?.rollback()
            .finished.then(
              () =>
                navigation.navigate(result.destinationURL, {
                  state: result.destinationState,
                }).finished
            );
          // await navigation.transition?.rollback().finished;
          // await navigation.navigate(result.destinationURL, { state: result.destinationState }).finished;
        } else if (result.type === "disallow") {
          disallowCount += 1;
          throw new Error(result.disallowReason);
        } else {
          // ...
          // Allow the transition
          allowCount += 1;
          return;
        }
      }
    );
  });

  ok(navigation.currentEntry)

  await navigation.navigate("/").finished;

  ok(navigation.currentEntry);
  ok(pathname(navigation.currentEntry?.url) === "/");
  ok(allowCount === 1);

  const redirectTargetUrl = `/redirected/${Math.random()}`;

  const targetUrl = new URL("/redirect", "https://example.com");
  targetUrl.searchParams.set("target", redirectTargetUrl);

  const { committed: redirectCommitted, finished: redirectFinishedErrored } =
    navigation.navigate(targetUrl.toString());
  redirectFinishedErrored.catch((error) => void error);
  await redirectCommitted.catch((error) => void error);

  const redirectError = await redirectFinishedErrored.catch((error) => error);

  // console.log({ redirectError });

  assert(redirectError);
  assert(redirectError instanceof Error);

  // TODO pending transition here would allow us to see the new navigation changes
  // const pendingTransition = navigation.transition;
  // ok(pendingTransition);
  // await pendingTransition;
  assert(redirectFinished);
  await redirectFinished;

  ok(pathname(navigation.currentEntry?.url) === redirectTargetUrl);
  ok(allowCount === 2);

  const expectedInitialError = `${Math.random()}`;
  const errorTargetUrl = new URL("/disallow", "https://example.com");
  errorTargetUrl.searchParams.set("reason", expectedInitialError);

  ok(disallowCount === 0);

  const { committed: disallowCommitted, finished: disallowFinished } =
    navigation.navigate(errorTargetUrl.toString());
  await disallowCommitted.catch((error) => error);
  const initialError = await disallowFinished.catch((error) => error);

  assert<Error>(initialError);
  assert(initialError instanceof Error);

  // console.log(initialError);

  assert(initialError.message === expectedInitialError);

  ok(allowCount === 2);
  ok(disallowCount === 1);
}

export async function navigationExamples(navigation: Navigation) {
  const url = `/${Math.random()}`;
  const stateSymbol = Symbol();
  const infoSymbol = Symbol();
  const state = { [stateSymbol]: true };
  const info = { [infoSymbol]: true };

  // Performs a navigation to the given URL, but replace the current history entry
  // instead of pushing a new one.
  // (equivalent to `location.replace(url)`)
  await navigation.navigate(url, { history: "replace" }).finished;

  // Replace the URL and state at the same time.
  await navigation.navigate(url, { history: "replace", state }).finished;

  // You can still pass along info:
  await navigation.navigate(url, { history: "replace", state, info }).finished;

  // Just like location.reload().
  await navigation.reload().finished;

  // Leave the state as-is, but pass some info.
  await navigation.reload({ info }).finished;

  // Overwrite the state with a new value.
  await navigation.reload({ state, info }).finished;
}

export async function usingInfoExample(navigation: Navigation) {
  if (new URL(navigation.currentEntry?.url ?? "https://example.com").pathname.startsWith("/photo/")) {
    await navigation.navigate("/").finished;
  }

  const photoGallery = new EventTarget();
  const document = new EventTarget();

  const photos = new Map<object, string>(
    Array.from({ length: 10 }).map((unused, index) => [{}, `/photo/${index}`])
  );
  const photoTargets = new Map<string, object>(
    [...photos.entries()].map(([key, value]) => [value, key])
  );
  const photoUrls = [...photos.values()];

  function getPhotoSiblings() {
    const index = photoUrls.indexOf(
      pathname(navigation.currentEntry?.url ?? "/unknown")
    );
    console.log({ index, url: navigation.currentEntry.url })
    if (index === -1) return [];
    return [photoUrls[index - 1], photoUrls[index + 1]];
  }
  function hasPreviousPhoto() {
    return !!getPreviousPhotoURL();
  }
  function hasNextPhoto() {
    return !!getNextPhotoURL();
  }
  function getPreviousPhotoURL() {
    return getPhotoSiblings()[0];
  }
  function getNextPhotoURL() {
    return getPhotoSiblings()[1];
  }
  function getPhotoURL(target: unknown) {
    if (!target || typeof target !== "object")
      throw new Error("Expected object target");
    return photos.get(target);
  }
  function isPhotoNavigation<T>(
    event: T
  ): event is T & { info: { via: string; thumbnail: object } } {
    function isLike(
      event: unknown
    ): event is { info: Record<string, unknown> } {
      return !!event;
    }
    return (
      isLike(event) &&
      typeof event.info === "object" &&
      typeof event.info.via === "string" &&
      typeof event.info.thumbnail === "object"
    );
  }

  document.addEventListener("keydown", async (event) => {
    if (event.key === "ArrowLeft" && hasPreviousPhoto()) {
      const url = getPreviousPhotoURL();
      await navigation.navigate(url, {
        info: { via: "go-left", thumbnail: photoTargets.get(url) },
      }).finished;
    }
    if (event.key === "ArrowRight" && hasNextPhoto()) {
      const url = getNextPhotoURL();
      await navigation.navigate(url, {
        info: { via: "go-right", thumbnail: photoTargets.get(url) },
      }).finished;
    }
  });

  photoGallery.addEventListener(
    "click",
    async ({ target }: Event & { target?: unknown }) => {
      const url = getPhotoURL(target);
      if (!url) return;
      await navigation.navigate(url, {
        info: { via: "gallery", thumbnail: target },
      }).finished;
    }
  );

  let lefts = 0,
    rights = 0,
    zoomies: object[] = [],
    loaded: string[] = [];

  function animateLeft() {
    lefts += 1;
  }
  function animateRight() {
    rights += 1;
  }
  function animateZoomFromThumbnail(thumbnail: object) {
    zoomies.push(thumbnail);
  }
  async function loadPhoto(url: string) {
    await new Promise<void>(queueMicrotask);
    loaded.push(pathname(url));
  }

  navigation.addEventListener("navigate", (e) => {
    e.intercept(
      async () => {
        if (isPhotoNavigation(e)) {
          const { thumbnail, via } = e.info;
          switch (via) {
            case "go-left": {
              await animateLeft();
              break;
            }
            case "go-right": {
              await animateRight();
              break;
            }
            case "gallery": {
              await animateZoomFromThumbnail(thumbnail);
              break;
            }
          }
        }
        await loadPhoto(e.destination.url);
      }
    );
  });

  const middleIndex = Math.round(photoUrls.length / 2);
  assert(middleIndex === 5);

  console.log({
    hasPreviousPhoto: hasPreviousPhoto(),
    hasNextPhoto: hasNextPhoto()
  })

  // console.log({
  //     via: "navigation",
  //     thumbnail: photoTargets.get(photoUrls[middleIndex])
  // });

  // We have not yet given a starting point
  ok(!hasPreviousPhoto(), "Expected no previous photo");
  ok(!hasNextPhoto(), "Expected no next photo");

  await navigation.navigate(photoUrls[middleIndex], {
    info: {
      via: "navigation",
      thumbnail: photoTargets.get(photoUrls[middleIndex]),
    },
  }).finished;

  // We should now have photos
  ok(hasPreviousPhoto(), "Expected previous photo");
  ok(hasNextPhoto(), "Expected next photo");

  ok(!lefts);
  ok(!rights);
  // console.log({ loaded });
  ok(loaded.includes(photoUrls[middleIndex]));

  await document.dispatchEvent({
    type: "keydown",
    key: "ArrowLeft",
  });

  ok(lefts === 1);
  ok(loaded.includes(photoUrls[middleIndex - 1]));

  await document.dispatchEvent({
    type: "keydown",
    key: "ArrowLeft",
  });

  ok(lefts === 2);
  ok(loaded.includes(photoUrls[middleIndex - 2]));

  await document.dispatchEvent({
    type: "keydown",
    key: "ArrowLeft",
  });

  ok(lefts === 3);
  ok(loaded.includes(photoUrls[middleIndex - 3]));

  await document.dispatchEvent({
    type: "keydown",
    key: "ArrowLeft",
  });

  ok(lefts === 4);
  ok(loaded.includes(photoUrls[middleIndex - 4]));

  await document.dispatchEvent({
    type: "keydown",
    key: "ArrowLeft",
  });

  ok(lefts === 5);
  ok(loaded.includes(photoUrls[middleIndex - 5]));

  await document.dispatchEvent({
    type: "keydown",
    key: "ArrowLeft",
  });

  // Should stay the same
  ok(lefts === 5);
  ok(loaded.includes(photoUrls[middleIndex - 5]));

  // Reset to middle, and go the other way
  await navigation.navigate(photoUrls[middleIndex], {
    info: {
      via: "navigation",
      thumbnail: photoTargets.get(photoUrls[middleIndex]),
    },
  }).finished;

  ok(!rights);

  await document.dispatchEvent({
    type: "keydown",
    key: "ArrowRight",
  });

  ok(rights === 1);
  ok(loaded.includes(photoUrls[middleIndex + 1]));

  await document.dispatchEvent({
    type: "keydown",
    key: "ArrowRight",
  });

  ok(rights === 2);
  ok(loaded.includes(photoUrls[middleIndex + 2]));

  await document.dispatchEvent({
    type: "keydown",
    key: "ArrowRight",
  });

  ok(rights === 3);
  ok(loaded.includes(photoUrls[middleIndex + 3]));

  await document.dispatchEvent({
    type: "keydown",
    key: "ArrowRight",
  });

  ok(rights === 4);
  ok(loaded.includes(photoUrls[middleIndex + 4]));

  await document.dispatchEvent({
    type: "keydown",
    key: "ArrowRight",
  });

  // Should stay the same
  ok(rights === 4);
  ok(loaded.includes(photoUrls[middleIndex + 4]));

  ok(!zoomies.length);

  await photoGallery.dispatchEvent({
    type: "click",
    target: photoTargets.get(
      pathname(navigation.currentEntry?.url ?? "/unknown")
    ),
  });

  ok(zoomies.length);
  ok(photoTargets.get(pathname(navigation.currentEntry?.url ?? "/unknown")));
  ok(
    zoomies.includes(
      photoTargets.get(pathname(navigation.currentEntry?.url ?? "/unknown")) ??
        {}
    )
  );
}

export async function nextPreviousButtons(navigation: Navigation) {
  const appState = {
    currentPhoto: 0,
    totalPhotos: 10,
  };
  const photos: Record<string, string> = {};
  const next: EventTarget & { disabled?: boolean } = new EventTarget();
  const previous: EventTarget & { disabled?: boolean } = new EventTarget();
  const permalink: EventTarget & { disabled?: boolean; textContent?: string } =
    new EventTarget();
  const currentPhoto: EventTarget & { src?: string } = new EventTarget();

  next.addEventListener("click", async () => {
    const nextPhotoInHistory = photoNumberFromURL(
      navigation.entries()[(navigation.currentEntry?.index ?? -2) + 1]?.url
    );
    if (nextPhotoInHistory === appState.currentPhoto + 1) {
      await navigation.forward().finished;
    } else {
      await navigation.navigate(`/photos/${appState.currentPhoto + 1}`)
        .finished;
    }
  });

  previous.addEventListener("click", async () => {
    const prevPhotoInHistory = photoNumberFromURL(
      navigation.entries()[(navigation.currentEntry?.index ?? -2) - 1]?.url
    );
    // console.log(prevPhotoInHistory)
    // console.log({ prevPhotoInHistory, matching: appState.currentPhoto - 1, nav: `/photos/${appState.currentPhoto - 1}` });
    if (prevPhotoInHistory === appState.currentPhoto - 1) {
      // console.log("BACK!");
      await navigation.back().finished;
    } else {
      // console.log({ navigate: `/photos/${appState.currentPhoto - 1}` })
      await navigation.navigate(`/photos/${appState.currentPhoto - 1}`)
        .finished;
    }
  });

  const photosPrefix = "/raw-photos";
  const contentPhotosPrefix = `/photo/content${photosPrefix}`;

  const localCache = new Map<string, string>();

  let fetchCount = 0;

  const fetchHandler = (event: FetchEvent) => {
    const { pathname } = new URL(event.request.url, "https://example.com");
    const [, photoNumber] =
      pathname.match(/^\/raw-photos\/(\d+)\.[a-z]+$/i) ?? [];
    if (!photoNumber) return;
    fetchCount += 1;
    photos[photoNumber] =
      photos[photoNumber] ||
      `https://example.com${contentPhotosPrefix}/${photoNumber}`;
    return event.respondWith(
      new Response(photos[photoNumber], {
        status: 200,
      })
    );
  };

  let navigateFinished!: Promise<void>;

  addEventListener("fetch", fetchHandler);

  navigation.addEventListener("navigate", (event) => {
    const photoNumberMaybe = photoNumberFromURL(event.destination.url);
    console.log({ canIntercept: event.canIntercept, photoNumberMaybe });
    if (!(typeof photoNumberMaybe === "number" && event.canIntercept)) return;
    const photoNumber: number = photoNumberMaybe;
    event.intercept((navigateFinished = handler()));
    async function handler() {
      console.log("transitioning for ", { photoNumber });

      // Synchronously update app state and next/previous/permalink UI:
      appState.currentPhoto = photoNumber;
      previous.disabled = appState.currentPhoto === 0;
      next.disabled = appState.currentPhoto === appState.totalPhotos - 1;
      permalink.textContent = event.destination.url;

      const existingSrc =
        event.destination.key && localCache.get(event.destination.key);
      console.log({ photoNumber, existingSrc, key: event.destination.key });
      if (typeof existingSrc === "string") {
        currentPhoto.src = existingSrc;
        return;
      }

      // Asynchronously update the photo, passing along the signal so that
      // it all gets aborted if another navigation interrupts us:
      const response = await fetch(`${photosPrefix}/${photoNumber}.jpg`, {
        signal: event.signal,
      });
      // const blob = await response.blob();
      // currentPhoto.src = URL.createObjectURL(blob);
      const src = await response.text();
      currentPhoto.src = src;
      if (event.destination.key) {
        localCache.set(event.destination.key, src);
      }
    }
  });

  // Is not a photo should not load
  await navigation.navigate("/").finished;

  ok(!currentPhoto.src);

  await navigation.navigate("/photos/0").finished;

  ok(navigateFinished);
  await navigateFinished;
  console.log("Current photo");
  console.log(JSON.stringify({ src: currentPhoto.src }));

  assert<string>(currentPhoto.src);
  ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/0`);
  ok(!next.disabled);
  ok(previous.disabled);

  await navigation.navigate("/photos/1").finished;

  ok(navigateFinished);
  await navigateFinished;

  console.log("Current photo");
  console.log(JSON.stringify({ src: currentPhoto.src }));
  assert<string>(currentPhoto.src);
  ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/1`);
  ok(!next.disabled);
  ok(!previous.disabled);

  // log: Updated window pathname to /photos/2
  await next.dispatchEvent({
    type: "click",
  });
  // Utilised navigate
  assert<string>(currentPhoto.src);
  ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/2`);

  await navigation.navigate("/photos/9").finished;

  assert<string>(currentPhoto.src);
  ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/9`);

  ok(next.disabled);
  ok(!previous.disabled);

  // log: Updated window pathname to /photos/8
  await previous.dispatchEvent({
    type: "click",
  });

  assert<string>(currentPhoto.src);
  // console.log(currentPhoto);
  // Utilised navigate
  ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/8`);

  // log: Updated window pathname to /photos/7
  await previous.dispatchEvent({
    type: "click",
  });

  assert<string>(currentPhoto.src);
  // Utilised navigate
  ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/7`);

  // Updated window pathname to /photos/8
  await next.dispatchEvent({
    type: "click",
  });
  // Updated window pathname to /photos/9
  await next.dispatchEvent({
    type: "click",
  });

  // Utilised navigation!
  assert<string>(currentPhoto.src);
  ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/9`);

  // This should be 8
  const finalFetchCount = fetchCount;
  assert(finalFetchCount === 8);

  // log: Updated window pathname to /photos/8
  await previous.dispatchEvent({
    type: "click",
  });

  // Utilised back!
  assert<string>(currentPhoto.src);
  ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/8`);

  // log: Updated window pathname to /photos/7
  await previous.dispatchEvent({
    type: "click",
  });

  // Utilised back!
  assert<string>(currentPhoto.src);
  ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/7`);

  // console.log({ finalFetchCount, fetchCount });

  if (!isWindowNavigation(navigation)) {
    ok(finalFetchCount === fetchCount);
  }

  // log: Updated window pathname to /photos/8
  await next.dispatchEvent({
    type: "click",
  });

  // Utilised forward!
  assert<string>(currentPhoto.src);
  ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/8`);

  if (!isWindowNavigation(navigation)) {
    ok(finalFetchCount === fetchCount);
  }
  // log: Updated window pathname to /photos/9
  await next.dispatchEvent({
    type: "click",
  });

  // Utilised forward!
  assert<string>(currentPhoto.src);
  ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/9`);
  if (!isWindowNavigation(navigation)) {
    ok(finalFetchCount === fetchCount);
  }

  removeEventListener("fetch", fetchHandler);

  function photoNumberFromURL(url?: string) {
    console.log(
      JSON.stringify({ photoNumberFromURL: url, path: pathname(url) })
    );
    if (!url) {
      return undefined;
    }
    const [, photoNumber] = /\/photos\/(\d+)/.exec(pathname(url)) ?? [];
    console.log({ url, photoNumber });
    if (photoNumber) {
      return +photoNumber;
    }
    return undefined;
  }
}

function pathname(url?: string): string {
  return new URL(url ?? "/", "https://example.com").pathname;
}
