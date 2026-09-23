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

Full source: Firefox 156 downloaded and initialized; initial Zen import succeeded; compiler bootstrap succeeded without system configuration changes. The source compile finished successfully with two jobs (95 minutes). The first source-built app launches but has a localization initialization issue; it is not a finished distributable. `concept-build.log` records its output. Local `mozconfig` disables debug symbols and compiled tests for this initial engine build. The offline concept tests run separately.

The second wholesale `npm run import` encountered already-applied upstream patches. Do not repeatedly apply patches to the existing engine tree. Existing overlay files are symlinked from `src`; when adding a file, link it into the generated engine overlay as well, or reset/reimport the engine only when needed with appropriate care. A fresh checkout uses the normal initial download/import/bootstrap sequence.

Fork Actions are disabled and zero workflow runs were reported. No live model calls or cloud builds were made.


# Native design correction — 2026-09-22

Taste design target and element/state inventory: `design/REVIEW.md`, with closed/open full-window target images. The native implementation was reviewed against the supplied Supaste screenshot and those targets, using a real MDN extension-documentation page.

Design review performed in Sierra Dev (installed Zen 1.21.16b engine):
- The unused URL row is gone; Cmd+T followed by typing an HTTPS address still navigates successfully.
- Native tabs, back/forward/reload, New Tab and downloads remain. The duplicate Create New and Clear controls are visually removed; underlying upstream commands remain.
- Closed and open notches have curved shoulders attached to the top edge. Icons replace Unicode control symbols. The actual open notch, its empty-folder state, and breadcrumbs were inspected.
- Pinned the real MDN page, created Architecture, opened the folder in place and pinned the page inside it. Existing development pins/tabs were retained.
- Dock plus opens the compact prompt. Typing a task and pressing Return opens the right panel with the page title and URL captured.
- Review defects found: cached black icons disappeared against dark cards; automatic input focus created a heavy double outline; the right panel obscured the article; two legacy task identities had the same colour. Corrections were implemented and rebuilt.

Final correction re-render is pending because the Mac locked again. Specifically unverified after that final rebuild: icon backgrounds, lighter prompt focus, distinct colours, page resizing beside the panel, persistent-agent appearance, editing/resaving drafts, selection top-right positioning and collapsed-selection dismissal. Earlier screenshots must not be presented as a final render of these corrections.

Code/build checks: nine offline tests pass, including active-tab/window rejection for collapsed-selection dismissal. JS syntax, Python builder syntax, formatting and diff whitespace checks pass. The rebuilt Sierra Dev app passes strict deep signature verification. UI-only source compilation succeeded; the full engine had already compiled successfully. The source app was assembled with resolved symlinks, passed signature verification and `--version`, and launched in its isolated profile; the native localization failure is recorded above. GitHub Actions remain disabled. No live model calls or cloud builds were made.

Not exercised this pass: physical shake, reduced-motion setting, narrow window, private/multiple windows, split view, compact mode, every retained upstream browser feature, or real agent execution (not implemented).

Independent code review corrections: collapse the URL container only in its resting state so native focused/open/breakout sizing remains available; mark the dock with a stable ID and `skipintoolbarset=true` so Zen toolbar customization does not treat it as a widget. Both corrections are rebuilt; final native interaction verification remains pending.

Source packaging follow-up: `./mach package` succeeded, creating the official omni layout and local DMG. The source builder now requires `dist/zen/Nightly.app` and verifies the concept files inside `browser/omni.ja` against the checkout. Corrected Sierra Source assembly and deep signature verification pass. The first localization failure was in the earlier raw developer-tree copy. The corrected package's runtime localization is still unverified because the Mac is locked; do not claim it fixed from packaging success alone.

# Native source and tool validation — 2026-09-23

The Mac was unlocked for this pass. The isolated Sierra Dev browser was resized to a 1410px-wide screen and inspected on the real MDN WebExtensions documentation page. Clicking beside the visible black notch, inside its expanded transparent target, opened the shelf. A saved task requested permission before reading that active tab; accepting produced a `browser.page.snapshot` event with 4,283 characters and a bounded preview. The panel correctly said that the model was not connected. The tab claim was released when the read ended.

The isolated Sierra Source app was rebuilt from the full Firefox/Zen source package with missing Zen Fluent strings added to its own `browser/omni.ja`. Native labels returned. MDN navigation, agent task creation and saving, the read-only consent dialog, the completed tool event and the open notch were verified in that source-built app. The source-built app passed strict deep signature verification during assembly. The normal installed Zen app and its profile were not changed.

Fourteen offline tests pass, including rejection of unknown tool names, denied consent, changed context during consent or page read, and bounded text-only actor results. Python syntax and diff checks pass. No live AI/model calls or cloud builds were made.

Design review compared the native source screenshot with the 1410 × 825 closed/open targets and the supplied Supaste shelf. Native evidence is in `design/native-closed-source-2026-09-23.jpg`, `design/native-agent-source-2026-09-23.jpg`, and final `design/native-empty-source-2026-09-23.jpg`, `design/native-populated-source-2026-09-23.jpg`, `design/native-folder-source-2026-09-23.jpg`. The empty notch's tall void was corrected and re-rendered. The populated shelf shows a real MDN favicon and a folder; opening the folder stays inside the notch and shows breadcrumbs. The current live MDN page includes its own navigation and ads, which the browser chrome does not replace.

The final local package replaces visible in-window Nightly labels with Sierra. macOS still exposes Nightly as the application-menu name from compiled upstream branding; release branding is a remaining build task.

Still unverified: physical shake without clicking, selection placement at several zoom levels, private and simultaneous windows, split view, compact mode and every upstream feature. Autonomous agent task execution, a model harness, background scheduling and credential brokering remain unimplemented.

# Live continuation — 2026-09-23

The page-read gate now accepts cancellation, releases the tab claim immediately when stopped, and checks ownership again before returning a result. The native browser aborts a read when its tab closes, another tab is selected, the URL changes, or the active space changes. The agent panel exposes Stop only while a read is active. Seventeen offline checks pass, including cancellation during a read, cancellation before dispatch and rejection of a result after tab ownership is reclaimed.

Native Sierra Dev checks: the idle panel does not show Stop; declining the browser permission prompt records “Permission declined” without reading the page. Native Sierra Source checks after rebuilding: the permission prompt still appears and approval completed a bounded MDN page snapshot. A synthetic slow native read was not run, so the fleeting Stop and active glow were verified by model tests and code review rather than a captured native frame.

Design review found a narrow-window defect: the fixed-width panel left an unusable sliver of the website visible. Below 760px it now takes the content area while leaving the native sidebar accessible; the redesigned state was re-rendered in both Sierra Dev and Sierra Source. The source build needed a minimum left offset so the panel did not cover the sidebar's trailing controls; `design/native-narrow-agent-source-2026-09-23.jpg` shows the final alignment. Full desktop panel sizing is unchanged. The model harness, autonomous execution and broader upstream regression checks remain outstanding.

Shutdown limitation found during rebuilds: after confirming Sierra's native Quit dialog, the isolated process sometimes remained alive and blocked replacement of the test bundle. The exact isolated process was terminated before rebuilding; the installed Zen app was untouched. The cause and a normal-quit regression test remain open.
