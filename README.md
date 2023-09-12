# `@virtualstate/navigation`

Native JavaScript [navigation](https://html.spec.whatwg.org/multipage/nav-history-apis.html#navigation-api) implementation 

[//]: # (badges)

### Support

 ![Node.js supported](https://img.shields.io/badge/node-%3E%3D16.0.0-blue) ![Deno supported](https://img.shields.io/badge/deno-%3E%3D1.17.0-blue) ![Bun supported](https://img.shields.io/badge/bun-%3E%3D0.1.11-blue) ![Chromium supported](https://img.shields.io/badge/chromium-%3E%3D98.0.4695.0-blue) ![Webkit supported](https://img.shields.io/badge/webkit-%3E%3D15.4-blue) ![Firefox supported](https://img.shields.io/badge/firefox-%3E%3D94.0.1-blue)

 <details><summary>Test Coverage</summary>

 ![Web Platform Tests 129/237](https://img.shields.io/badge/Web%20Platform%20Tests-129%2F237-brightgreen) ![92.8%25 lines covered](https://img.shields.io/badge/lines-92.8%25-brightgreen) ![92.8%25 statements covered](https://img.shields.io/badge/statements-92.8%25-brightgreen) ![83.33%25 functions covered](https://img.shields.io/badge/functions-83.33%25-brightgreen) ![83%25 branches covered](https://img.shields.io/badge/branches-83%25-brightgreen) 

</details>

[//]: # (badges)

## Install 


<details><summary>npm / yarn / GitHub</summary>


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
</details>

<details><summary>Skypack</summary>

- [Package Registry Link - Skypack](https://www.skypack.dev/view/@virtualstate/navigation)

```typescript
const { Navigation } = await import("https://cdn.skypack.dev/@virtualstate/navigation");
```

_Or_

```typescript
import { Navigation } from "https://cdn.skypack.dev/@virtualstate/navigation";
```
</details>

<details><summary>importmap</summary>

[`importmap` documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap)

```html
<script type="importmap">
    {  
        "imports": {
            "@virtualstate/navigation": "https://cdn.skypack.dev/@virtualstate/navigation"
        }
    }
</script>
<script type="module">
    import { Navigation } from "@virtualstate/navigation"
</script>
```
</details>

## Usage

See the [MDN documentation for the Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) for in depth information on usage. 

<details><summary>Examples</summary>

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

navigation.addEventListener("navigate", async ({ destination, intercept }) => {
    intercept(loadPhotoIntoCache(destination.url));
});
```

## URLPattern

You can match `destination.url` using [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API)

```typescript
import {Navigation} from "@virtualstate/navigation";
import {URLPattern} from "urlpattern-polyfill";

const navigation = new Navigation();

navigation.addEventListener("navigate", async ({destination, intercept}) => {
    const pattern = new URLPattern({ pathname: "/books/:id" });
    const match = pattern.exec(destination.url);
    if (match) {
        intercept(transition());
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

navigation.addEventListener("currententrychange", () => {
    console.log({ updatedState: navigation.currentEntry?.getState() });
});

await navigation.updateCurrentEntry({
    state: {
        items: [
            "first",
            "second"
        ],
        index: 0
    }
}).finished;

await navigation.updateCurrentEntry({
    state: {
        ...navigation.currentEntry.getState(),
        index: 1
    }
}).finished;
```
</details>

## Polyfill

If a global instance of the navigation API is not available, this will provide one integrated into the History API

```typescript
import "@virtualstate/navigation/polyfill";

await navigation.navigate("/").finished;
```