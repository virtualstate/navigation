# `@virtualstate/app-history`

Native JavaScript [app-history](https://github.com/WICG/app-history) implementation 

[//]: # (badges)

### Support

 ![Node.js supported](https://img.shields.io/badge/node-%3E%3D16.0.0-blue) ![Deno supported](https://img.shields.io/badge/deno-%3E%3D1.17.0-blue) ![Chromium supported](https://img.shields.io/badge/chromium-%3E%3D98.0.4695.0-blue) ![Webkit supported](https://img.shields.io/badge/webkit-%3E%3D15.4-blue) ![Firefox supported](https://img.shields.io/badge/firefox-%3E%3D94.0.1-blue)

 ### Test Coverage

 ![Web Platform Tests 103/158](https://img.shields.io/badge/Web%20Platform%20Tests-103%2F158-brightgreen) ![93.52%25 lines covered](https://img.shields.io/badge/lines-93.52%25-brightgreen) ![93.52%25 statements covered](https://img.shields.io/badge/statements-93.52%25-brightgreen) ![85.02%25 functions covered](https://img.shields.io/badge/functions-85.02%25-brightgreen) ![83.94%25 branches covered](https://img.shields.io/badge/branches-83.94%25-brightgreen)

[//]: # (badges)

## Install 

### Snowpack

- [Package Registry Link - Snowpack](https://www.skypack.dev/view/@virtualstate/app-history)

```typescript
const { AppHistory } = await import("https://cdn.skypack.dev/@virtualstate/app-history");
```

_Or_

```typescript
import { AppHistory } from "https://cdn.skypack.dev/@virtualstate/app-history";
```


### npm / yarn / GitHub


- [Package Registry Link - GitHub](https://github.com/virtualstate/app-history/packages)
- [Package Registry Link - npm](https://www.npmjs.com/package/@virtualstate/app-history)

```
npm i --save @virtualstate/app-history
```

_Or_

```
yarn add @virtualstate/app-history
```

Then

```typescript
import { AppHistory } from "@virtualstate/app-history";
```

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

