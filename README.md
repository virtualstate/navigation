# `@virtualstate/navigation`

Native JavaScript [navigation](https://github.com/WICG/navigation-api) implementation 

[//]: # (badges)

### Support

 ![Node.js supported](https://img.shields.io/badge/node-%3E%3D16.0.0-blue) ![Deno supported](https://img.shields.io/badge/deno-%3E%3D1.17.0-blue) ![Bun supported](https://img.shields.io/badge/bun-%3E%3D0.1.11-blue) ![Chromium supported](https://img.shields.io/badge/chromium-%3E%3D98.0.4695.0-blue) ![Webkit supported](https://img.shields.io/badge/webkit-%3E%3D15.4-blue) ![Firefox supported](https://img.shields.io/badge/firefox-%3E%3D94.0.1-blue)

 ### Test Coverage

 ![Web Platform Tests 100/227](https://img.shields.io/badge/Web%20Platform%20Tests-100%2F227-brightgreen) ![93.53%25 lines covered](https://img.shields.io/badge/lines-93.53%25-brightgreen) ![93.53%25 statements covered](https://img.shields.io/badge/statements-93.53%25-brightgreen) ![84.38%25 functions covered](https://img.shields.io/badge/functions-84.38%25-brightgreen) ![83.64%25 branches covered](https://img.shields.io/badge/branches-83.64%25-brightgreen)

[//]: # (badges)

## Install 

### Skypack

- [Package Registry Link - Skypack](https://www.skypack.dev/view/@virtualstate/navigation)

```typescript
const { Navigation } = await import("https://cdn.skypack.dev/@virtualstate/navigation");
```

_Or_

```typescript
import { Navigation } from "https://cdn.skypack.dev/@virtualstate/navigation";
```


### npm / yarn / GitHub


- [Package Registry Link - GitHub](https://github.com/virtualstate/navigation/packages)
- [Package Registry Link - npm](https://www.npmjs.com/package/@virtualstate/navigation)

```
npm i --save @virtualstate/navigation
```

_Or_

```
yarn add @virtualstate/navigation
```

Then

```typescript
import { Navigation } from "@virtualstate/navigation";
```

## Navigation

```typescript
import { Navigation } from "@virtualstate/navigation";

const navigation = new Navigation();

// Set initial url
navigation.navigate("/");

navigation.navigate("/skipped");

// Use .finished to wait for the transition to complete
await navigation.navigate("/awaited").finished;

```

## Waiting for events

```typescript
import { Navigation } from "@virtualstate/navigation";

const navigation = new Navigation();

navigation.addEventListener("navigate", async ({ destination, preventDefault }) => {
    if (new URL(destination.url).pathname === "/disallow") {
        preventDefault();
    }
});

await navigation.navigate("/allowed").finished; // Resolves
await navigation.navigate("/disallow").finished; // Rejects

```

## Transitions

```typescript
import { Navigation } from "@virtualstate/navigation";
import { loadPhotoIntoCache } from "./cache";

const navigation = new Navigation();

navigation.addEventListener("navigate", async ({ destination, transitionWhile }) => {
    transitionWhile(loadPhotoIntoCache(destination.url));
});
```

## URLPattern

You can match `destination.url` using [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API)

```typescript
import {Navigation} from "@virtualstate/navigation";
import {URLPattern} from "urlpattern-polyfill";

const navigation = new Navigation();

navigation.addEventListener("navigate", async ({destination, transitionWhile}) => {
    const pattern = new URLPattern({ pathname: "/books/:id" });
    const match = pattern.exec(destination.url);
    if (match) {
        transitionWhile(transition());
    }

    async function transition() {
        console.log("load book", match.pathname.groups.id)
    }
});

navigation.navigate("/book/1");
```

## State

```typescript

import { Navigation } from "@virtualstate/navigation";

const navigation = new Navigation();

navigation.addEventListener("currentchange", () => {
    console.log({ updatedState: navigation.current?.getState() });
});

await navigation.updateCurrent({
    state: {
        items: [
            "first",
            "second"
        ],
        index: 0
    }
}).finished;

await navigation.updateCurrent({
    state: {
        ...navigation.current.getState(),
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
import { Navigation } from "@virtualstate/navigation";

const navigation = new Navigation();
const origin = typeof location === "undefined" ? "https://example.com" : location.origin;

navigation.addEventListener("currentchange", () => {
    const { current } = navigation;
    if (!current || !current.sameDocument) return;
    const state = current.getState() ?? {};
    const { pathname } = new URL(current.url, origin);
    if (typeof window !== "undefined" && window.history) {
        window.history.pushState(state, state.title, origin)
    }
})
```