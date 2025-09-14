<!-- See https://keepachangelog.com/en/1.1.0/ for information -->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1-alpha.210] - 2025-09-14

### Added

- Set `navigateType` to `"replace"` on `history: "replace"` or `history: "auto"` with same target URL as `currentEntry` [Issue #43](https://github.com/virtualstate/navigation/issues/43)
- Set `key` to `currentEntry.key` on `"replace"` [Issue #43](https://github.com/virtualstate/navigation/issues/43), [See]()

### Changed

- Include `destination.id` from `entry.id` [See](https://developer.mozilla.org/en-US/docs/Web/API/NavigationDestination/id)

> Note, the `destination` entry `id` and `key` is always known in this implementation ahead of the 
> navigate event dispatching for this reason the values are always included rather than an empty string

## [1.0.1-alpha.209] - 2025-03-23

### Added

- Dedicated `CHANGELOG.md` [Issue #20](https://github.com/virtualstate/navigation/issues/20)

## [1.0.1-alpha.208] - 2025-03-23

### Added

- Ignore anchor elements with `target="otherWindow"` [Issue #38](https://github.com/virtualstate/navigation/issues/38)
- Correct `navigation.transition.from`, now derived from `navigation.currentEntry` at the start of transition [Issue #31](https://github.com/virtualstate/navigation/issues/31)

## [1.0.1-alpha.207] - 2025-03-23

### Added

- Include warning for old signature usage [Issue #37](https://github.com/virtualstate/navigation/issues/37)

### Changed

- Update documentation to match latest spec [Issue #37](https://github.com/virtualstate/navigation/issues/37)
- Use `!Object.hasOwn(globalThis, 'navigation')` for existing global check in polyfill [PR #36](https://github.com/virtualstate/navigation/pull/36)

## [1.0.1-alpha.206]

### Changed

- Updated default serializer for polyfill to JSON [PR #35](https://github.com/virtualstate/navigation/pull/35)

