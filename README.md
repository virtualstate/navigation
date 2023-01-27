# Navigation API Polyfill

Native JavaScript [Navigation API](https://github.com/WICG/navigation-api) implementation.

A fork of [`@virtualstate/navigation`](https://github.com/virtualstate/navigation) that adds missing browser history integration. 

It mostly works, but is probably not spec compliant, specifically when interacting with iframes, to which no consideration was given.

## Usage
Probably best to add it as a sub module and import as `./vendor/navigation/src/polyfill`.

## Settings
This polyfill comes in 5 "levels", each getting closer to full Navigation API , at the cost of increasing intrusiveness and performance/memory overhead. Settings can be changed in [`get-navigation.ts`](./src/get-navigation.ts).

### History Integration
Integrate polyfilled Navigation API with legacy History API. 
Specifically, `popstate` will trigger navigation traversal and 
navigates will push state on History API.
This enables forward/backward to work in most cases, but not after page refresh, etc. 
See [Persist Entries](#persist-entries) on how to recover from hard resets.
 
__WIP__: No consideration given to iframes and other edge cases. 
`hashchange` not implemented (but might work anyway for most cases with [Intercept Events](#intercept-events)?). `scroll` not implemented.

### Persist Entries
Persists all navigation entries in history state. 
This enables forward/backward to work after hard refresh, closing/reopening tab, etc.
but comes at the cost of storing all navigation history entries _on every history frame_.
This isn't quite as crazy as it seems, as each entry only consists of `url`, `key` and `id`, but you might want to disable it regardless.
  
__WIP__: Maybe store entries in session storage instead and only keep an id in history state?
What's worse, sync access + stringification or duplication on history state? 🤔 

### Persist Entries+State
Like [Persist Entries](#persist-entries), except also stores the state for each navigation entry.
Note that you might not need this if you only need the state of the current navigation entry, 
which works with [History Integration](#history-integration) alone.
Enabling this allows retrieving the state of *any navigation entry even after a hard refresh*.

__WIP__: State is stringified and stored in `sessionStorage`. This works for small objects, but gets awkward when storing large array buffers, etc. A more advanced implementation could combine session storage with a [Storage Area](https://workers.tools/kv-storage-polyfill) (Indexed DB) for better perf...

### Patch History
Monkey patches History API methods to call new Navigation API methods instead.
Could solve issues when combining Navigation API with frameworks that use the legacy History API, or it might cause additional issues instead 🤷‍♂️.

__NOTE__: This performs some [prototype acrobatics][1] to hide the "real" history state from the application. If this sounds scary you might want to disable this.

[1]: https://github.com/virtualstate/navigation/blob/85da3f677be5c9e26d0b261decde3ee989915e5a/src/get-navigation.ts#L183-L184

### Intercept Events
Intercepts clicks on `a` tags and `form` submissions and conditionally calls `preventDefault` based on application code response ot the `navigate` event.
This is the final piece of the Navigation API puzzle, as it allows using vanilla HTML elements instead of framework specific components like `<Link/>` or `<A/>`. 
In practice you might want to use those anyway, in which case you wouldn't need to enable this setting.
