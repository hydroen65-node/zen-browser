# Sierra development foundation

This is a downstream fork of Zen, retaining its Firefox engine and existing implementation. Sierra is a temporary development name. This milestone starts native implementation; it is not the completed browser or an AI-capable daily driver.

## Run the native UI development app

On the development Mac, open `dist/Sierra Dev.app`. Its launcher always selects `.concept-profile` beside the source checkout. Alternatively run `scripts/run-concept-dev.sh`. The installed `/Applications/Zen.app` is not modified by the builder.

To rebuild this development app after quitting it:

```sh
python3 scripts/build-concept-dev.py
```

The development app overlays the new source modules onto the installed Zen 1.21.16b engine. It is **not a full Gecko source compilation**. `concept-build.json` in the bundle records the base version. macOS signing is local and ad-hoc, not a signed distribution release. Vendor-only identity and passkey entitlements are not carried into this development identity. Existing engine JIT entitlements are retained. Dev-only policies prevent the overlay from updating itself into stock Zen; stock Zen's updater is untouched.

The source branch is based on upstream `dev` (Firefox 156 / Zen 1.22.3b). Its engine differs from the installed overlay. Both paths must be verified before release. `browser.concept.enabled` defaults to false in source builds, and is enabled explicitly in the isolated development profile.

## Locally compiled engine

The full Firefox 156 / Zen source build completed successfully (95 minutes with two local jobs). Incremental UI builds use `npm run build:ui`, followed by `cd engine && ./mach package`. `python3 scripts/build-concept-source.py` then assembles `dist/Sierra Source.app`, resolves build symlinks and gives it a separate `.concept-source-profile`. Do not launch the raw Nightly.app against a normal browsing profile.

The first source app assembled from the raw developer layout launched with unlabeled controls and Fluent lookup errors. The packaged source app still omitted Zen's Fluent files. The source builder now includes those locale files in its isolated omni package; native controls, navigation and the agent panel were verified in Sierra Source on September 23. Both builders verify their app signatures and refuse to overwrite an unrecognized or running destination.

## Implemented foundation

- Dark native browser chrome and notch; Zen's native sidebar, tabs, navigation, menu, folders, extensions and other browser code remain in the fork.
- Native space switcher, notch pins, folder creation and breadcrumb traversal inside the notch. Pinned URLs open real tabs. No thumbnail imitation of a website.
- Per-profile persistence for notch items and task drafts, separated by native space ID. One shared in-process store serializes writes across normal windows. Private windows use memory only. Writes drain on profile shutdown.
- Cursor content actor for selection dwell and deliberate pointer shake. Parent only accepts the selected tab in the active browser window. Form controls and editable content are excluded from normal gesture targeting.
- Selection actions and a small prompt leading into the native right context panel. Context is a local snapshot; nothing is sent to a model.
- Explicitly pending task drafts. Persistent/ephemeral identity and stronger working-tab glow styles are prepared; no draft pretends to be a running agent.
- A first read-only `browser.page.snapshot` tool uses the native content actor to return bounded page title, URL and visible text. The browser asks before reading the active tab, gates the call through tab ownership, checks page/space identity again after the read, releases ownership and shows a local activity event. In-flight reads can be stopped or interrupted by tab closure, tab switch, navigation or space switch; late results are discarded. It does not contact a model or run the saved task.

## Next implementation work

1. Attach an existing agent harness behind a narrow local bridge. Define typed task events and tool requests; no arbitrary browser-chrome evaluation. Build replayable offline fixtures before live calls.
2. Extend the existing read-only ownership gate to every future tool action and user interruption, tab navigation, tab closure, workspace changes and agent cancellation. Permission state must live in the trusted browser, never the model.
3. Implement real task lifecycle, agent-owned groups, per-space memory, named persistent agents, cancellation, recovery and truthful activity traces. Show actions and concise progress summaries, not hidden model reasoning.
4. Add link-provenance Trails independently of Zen's manual folders. Test source-tab inheritance, standalone new tabs, pinning and moving between spaces. Preserve native folder behavior while adding provenance.
5. Finish notch editing, nested folder drag-and-drop, keyboard navigation, accessible tooltips, per-space identity and depth handling. Integrate ask-agent with the native New Tab prompt.
6. Watch and ad mechanisms: retain existing Zen functionality, implement separately bounded network rules, persistent element removal and experimental DOM classification. Do not claim the unverified “Jev” model exists.
7. Credential broker, per-agent filesystem sandbox, scheduled jobs and persistent-agent VM lifecycle. These remain unimplemented. Keep credentials outside model context and require explicit grants for added host access.
8. Broaden regression coverage for retained Zen features, update/signing strategy and platform verification before distribution.

## Resource and privacy limits

No live AI calls, paid infrastructure or remote browser builds are part of this milestone. GitHub Actions are disabled in the downstream fork to avoid unintentionally running upstream release workflows. Profile data, logs, installed-engine copies and build outputs stay untracked. Stored task context is local JSON, not an encrypted memory system.

## Design direction

Taste design: charcoal native sidebar, black notch anchored to the top edge, spaces represented by icons, folder contents and breadcrumbs within the notch. Colour signals actual agent activity, with a stronger blurred edge around its tab. Text-selection actions sit above the selected text near its right edge; shaking exposes a compact prompt. Keep standard Zen controls reachable while removing duplicate chrome.

Design review must cover the actual native app, including keyboard access, interrupted gestures, zoom and multiple displays, private windows, split view, compact mode and recovery. Passing offline model tests alone does not verify these interactions.
