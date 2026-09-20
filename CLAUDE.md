# Project-specific instructions

## `manifest.json` version

Never bump the `version` field in `WebContent/manifest.json` unless the user explicitly asks
for it in that turn. It must track actual releases published to the Chrome Web Store, not
internal feature work or changelog entries — bumping it autonomously (e.g. alongside a
`WebContent/versions/history.html` changelog entry) puts it out of sync with reality.

Changelog entries in `WebContent/versions/history.html` can still be added or updated without
a version bump; just leave `manifest.json` alone unless told otherwise.

## Documenting changes as you make them

Log every change in `WebContent/versions/history.html` as you make it, with one exception:
skip the entry if the change only fixes a bug that was introduced since the last published
version (i.e. the bug was never in a released version, so there's nothing for a user to be
told about).

### `WebContent/guide/guide.html`

If a change affects how a feature is used, update `guide.html` to describe it:

- Wrap the added or changed text in an inline (not stylesheet) yellow-background span.
- Prefix the affected paragraph with a `[TODO]` marker — do this even when the change is a
  deletion, marking whatever paragraph the deleted content belonged to. Never add a second
  `[TODO]` to a paragraph that already has one.

### `WebContent/versions/history.html`

Every logged change gets a `[TODO]` marker, so unreviewed entries are easy to find before a
release:

- **User-facing feature** (something a user needs to know about): belongs under **New
  Features**. Either update the relevant existing `<h5>` entry or add a new one, and put the
  `[TODO]` marker immediately after the `<h5>` heading text.
- **Everything else** (internal/technical, nothing a user needs to know about): belongs under
  **Technical Changes**, as its own `<p class="flow-text">`, prefixed with a `[TODO]` marker.

## `history.html` layout

- **Technical Changes**: one `<div class="row">` containing two full-width `<div class="col
  s12">` columns — the first holding the `<h4>` heading and its divider, the second holding
  every `<p class="flow-text">` item together.
- **New Features**: a single `<div class="row">` with exactly two `<div class="col s12 l6">`
  columns, placed between the version heading (or `UNRELEASED`) and Technical Changes. Split
  feature entries across the two columns so both end up roughly the same height, with the most
  important features nearest the top of each column.

## Releasing

When told to release the extension, work through these steps in order:

1. **Check for unresolved TODOs.** If `history.html` or `guide.html` still contains any
   `[TODO]` marker, stop and tell the user which file(s) need reviewing first — do not
   continue.
2. **Confirm the version.** If the user didn't give one, work out the next version number and
   confirm it with them before continuing.
3. **Finalize the entry.** In both `history.html` and `RELEASE.txt`, replace `UNRELEASED` with
   `v<version> - <today's date>`, spelling the month out in full (e.g. `v1.9 - 20 September
   2026`, not `20 Sep 2026`). Also bump the `version` field in `WebContent/manifest.json` to
   `<version>` (no `v` prefix — Chrome's manifest format doesn't allow one).
4. **Clean up `guide.html`.** Remove any remaining yellow-background styling — step 1 already
   guarantees nothing yellow is still unreviewed.
5. **Commit and tag** this release commit as `v<version>` (e.g. `v1.9`) — pushing this tag is
   what triggers the `.github/workflows/release.yml` GitHub Actions release.
6. **Reopen for the next cycle.** Add a new, empty `UNRELEASED` section: at the top of
   `history.html` (below the intro paragraph) and in `RELEASE.txt` (below the `History`
   header).
7. **Commit and push.**
