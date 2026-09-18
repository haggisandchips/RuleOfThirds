# Project-specific instructions

## manifest.json version

Never bump the `version` field in `WebContent/manifest.json` unless the user explicitly
asks for it in that turn. It must track actual releases published to the Chrome Web
Store, not internal feature work or changelog entries - bumping it autonomously (eg
alongside a `versions/history.html` changelog entry) puts it out of sync with reality.

Changelog entries in `WebContent/versions/history.html` can still be added/updated
without a version bump; just leave `manifest.json` alone unless told otherwise.
