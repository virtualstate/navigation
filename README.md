# `@virtualstate/app-history`

Native JavaScript [app-history](https://github.com/WICG/app-history) implementation 

[//]: # (badges)

![nycrc config on GitHub](https://img.shields.io/nycrc/virtualstate/app-history) ![95.78%25 lines covered](https://img.shields.io/badge/lines-95.78%25-brightgreen) ![95.78%25 statements covered](https://img.shields.io/badge/statements-95.78%25-brightgreen) ![94.7%25 functions covered](https://img.shields.io/badge/functions-94.7%25-brightgreen) ![85.36%25 branches covered](https://img.shields.io/badge/branches-85.36%25-brightgreen)

[//]: # (badges)

## Navigation

```typescript
import { AppHistory } from "./app-history";

const appHistory = new AppHistory();

// Set initial url
appHistory.navigate("/");

appHistory.navigate("/skipped");

// Use .finished to wait for the transition to complete
await appHistory.navigate("/awaited").finished;

```

## Waiting for events

```typescript
import { AppHistory } from "./app-history";

const appHistory = new AppHistory();

appHistory.addEventListener("navigate", async ({ destination }) => {
    if (destination.url === "/disallow") {
        throw new Error("No!");
    }
});

await appHistory.navigate("/allowed").finished; // Resolves
await appHistory.navigate("/disallow").finished; // Rejects

```

## Transitions

```typescript
import { AppHistory } from "./app-history";
import { loadPhotoIntoCache } from "./cache";

const appHistory = new AppHistory();

appHistory.addEventListener("navigate", async ({ destination, transitionWhile }) => {
    transitionWhile(loadPhotoIntoCache(destination.url));
});
```

## State

```typescript

import { AppHistory } from "./app-history";

const appHistory = new AppHistory();

appHistory.addEventListener("currentchange", () => {
    console.log({ updatedState: appHistory.current?.getState() });
});

await appHistory.updateCurrent({
    state: {
        items: [
            "first",
            "second"
        ],
        index: 0
    }
}).finished;

await appHistory.updateCurrent({
    state: {
        ...appHistory.current.getState(),
        index: 1
    }
}).finished;
```


## Updating browser url

> This is a pending development task.
> The below code will help visually update the window

This can be achieved various ways, but if your application completely utilises
the app history interface, then you can directly use `pushState` to immediately
update the window's url. 

This does not take into account the browser's native back/forward functionality,
which would need to be investigated further.

```typescript
import { AppHistory } from "./app-history";

const appHistory = new AppHistory();
const origin = typeof location === "undefined" ? "https://example.com" : location.origin;

appHistory.addEventListener("currentchange", () => {
    const { current } = appHistory;
    if (!current || !current.sameDocument) return;
    const state = current.getState() ?? {};
    const { pathname } = new URL(current.url, origin);
    if (typeof window !== "undefined" && window.history) {
        window.history.pushState(state, state.title, origin)
    }
})
```

