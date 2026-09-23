# Trails implementation contract

Status: implementation contract with the native creation seam and first sidebar presentation implemented. Visual decisions remain in `design/SIERRA_DESIGN_SYSTEM.md` and with the main design pass. Native interaction and restore verification are still required.

## Invariant

A Trail is a parent relationship between actual browser tabs, created from **link provenance**. It is not a Zen folder, a pinned-tab category, a tab owner, a selected-tab relation, or an AI guess. A tab opened freely by the New Tab button, Cmd+T, the address field, a bookmark, or an external application has no Trail parent even if another tab is selected. A link opened from a child Trail inherits that child as parent. Manual folders and pinning remain independent and retain their native behavior.

## Native creation seam

Use `Tabbrowser.addTab` in the tracked `src/browser/components/tabbrowser/Tabbrowser-sys-mjs.patch`, mirrored to `engine/browser/components/tabbrowser/Tabbrowser.sys.mjs` for local compilation. Near the existing `openerTab` calculation, compute a **separate** provenance parent:

- Prefer `openerBrowser` when `getTabForBrowser(openerBrowser)` resolves to a live tab in this same tabbrowser.
- Otherwise use the selected tab only when `relatedToCurrent` is true **and** `referrerInfo.originalReferrer` exists. This catches link-opening paths that supply a referrer without an opener browser.
- Never infer from `ownerTab` or `openerTab` alone. Zen’s New Tab and several Glance/folder paths set those for positioning or focus, which would create false Trails.
- Reject self, removed, cross-window, private/non-private, Glance, or other nonordinary sources. A failed provenance check means a root tab, not an error.

The new tab gets an ephemeral `concept-trail-parent` marker referring to its parent's stable Trail ID before `TabOpen` fires. Give ordinary source tabs a stable ID when first used as a parent. Use UUIDs or another collision-resistant ID, never tab position, URL, title, or browser browsing context ID. Do not mutate Zen’s native `openerTab`, owner, folder, pinned, workspace, or insertion logic. The marker must be disabled when `browser.concept.enabled` is false so upstream behavior is untouched.

## Durable state and restoration

Use Firefox `SessionStore.setCustomTabValue/getCustomTabValue` for `concept.trail.id` and `concept.trail.parent`; these are designed for tab-scoped session state. A small dedicated concept module may coordinate this with chrome `TabOpen`/restore events. Restore from the custom values first; never create a new parent merely because the restored tab becomes selected. If native session restore reuses a duplicate tab’s custom values, mint a new ID for the duplicate and clear its inherited parent. On a moved Trail, the parent relation remains if both tabs move to the destination space; a single moved child becomes root unless its parent is in that space. Pinning should not rewrite the relation. Private windows keep Trail state only in memory and must not write to the persistent concept store.

Parent closing: surviving children become roots in their current space while preserving their own children. Do not close or relocate descendants. If a source tab has no ID until a child is opened, create its ID then; persist once, not on every tab selection or read.

## Sidebar presentation seam

Expose a read-only Trail snapshot for the current space as `(tab, id, parentId, depth)` in stable visible order. The UI layer applies indentation and a fine rail to native tab rows, around 16–18 CSS px per level, capped visually after three levels with horizontal scroll or a depth indicator. A parent’s descendants must remain adjacent in order, but do not continuously resort tabs in the background. Never place a freestanding tab into a manual Zen folder. A single pin button can promote a tab or Trail through native pinning without creating a second bookmarks model.

The functional implementation must not edit `BrowserConcept.mjs`, `browser-concept.css`, or design assets; main thread integrates rendering and visual checks after the provenance data is correct.

## Focused verification

1. New Tab button and Cmd+T remain root; opening typed URL/search remains root.
2. Link opened in a new tab from a root is a child; link from that child is a grandchild. Test foreground and background link opening where available.
3. Context-menu “open link in new tab” and `target=_blank` use provenance when native information exists; an external app or bookmark stays root.
4. Native folder, pin, Glance, and split-view operations must not create false parents.
5. Session restore retains IDs and parent links, and duplicate tab does not steal the original identity. Parent close promotes children to roots. Space move keeps only valid same-space relations.
6. Build the affected UI source and run targeted offline tests. Report any event path or restore edge that cannot be verified natively; do not claim the visual sidebar complete from model tests.

Avoid external services and live AI calls. Preserve the source fork’s licensing and normal Zen behaviors.
