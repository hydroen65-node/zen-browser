# Native milestone validation — 2026-09-20

Tested on the isolated Sierra Dev app using the installed Zen 1.21.16b engine. This is not full regression certification.

- Native app launches with `.concept-profile`; normal Zen app bundle is unchanged.
- Dark sidebar, closed notch, open notch and folder breadcrumbs inspected in native screenshots.
- Native address entry and HTTPS navigation to zen-browser.app work; the browser reports the site's verified certificate.
- Pinning the current real page, creating a folder, opening it in the notch and pinning within it work.
- Root and nested pins were confirmed in the local persisted store; the root pin survived multiple app restarts.
- Selecting page text with the keyboard exposes Explain / Summarize / Ask above the selection near its right edge. Explain opens the right panel with the captured selection.
- The small prompt opens from the dock plus button. Typing a prompt and pressing Return opens the context panel. This is also the component used by the shake detector.
- Saving a task reports that it has not started. Saved task identity survived restart. The final save path was checked after changing it to wait for disk persistence.
- Eight offline tests pass: deliberate shake and cooldown; ordinary/jitter/slow movement rejection; active-tab consent and revocation; competing claims; safe URL protocols; repeated-request consent bypass rejection; selected-tab/window actor checks; malformed message and context bounds.
- Python builder syntax check, JavaScript syntax check, formatting and `git diff --check` pass. Development bundle passes `codesign --verify --deep --strict`.
- Read-only independent code review identified and prompted fixes for the ownership bypass, multiwindow store, shutdown write drain, malformed actor messages, build staging and development-only enablement.

Not yet verified: a real pointer-shake gesture through native automation (the available native tool does not offer mouse movement without clicking); selection geometry at multiple zoom levels/displays; private windows and simultaneous-window UI flows; split view/compact mode; every retained upstream feature. Agent-coloured tab lighting has no real execution backend to drive yet. No task execution is claimed.

Full source: Firefox 156 downloaded and initialized; initial Zen import succeeded; compiler bootstrap succeeded without system configuration changes. The source compile is underway with two jobs, not yet a finished distributable. `concept-build.log` records its output. Local `mozconfig` disables debug symbols and compiled tests for this initial engine build. The offline concept tests run separately.

The second wholesale `npm run import` encountered already-applied upstream patches. Do not repeatedly apply patches to the existing engine tree. Existing overlay files are symlinked from `src`; when adding a file, link it into the generated engine overlay as well, or reset/reimport the engine only when needed with appropriate care. A fresh checkout uses the normal initial download/import/bootstrap sequence.

Fork Actions are disabled and zero workflow runs were reported. No live model calls or cloud builds were made.
