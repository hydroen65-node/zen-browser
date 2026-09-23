# Sierra native design pass — 2026-09-22

## Taste design

Task: read browser extension documentation, keep source/reference tabs nearby, pin related pages into an Architecture folder, and save a page-aware agent task. Retain Zen's real tab, navigation, workspace and security systems. Avoid claiming task execution before the harness is connected.

Evidence: user's Supaste screenshot (800 × 280) has a black shelf attached to the upper edge, concave shoulders, approximately 24px lower corners, compact circular utilities, one navigation row and a horizontal card strip. User explicitly replaces category labels with space icons and replaces categories with breadcrumbs inside folders. Arc-like priority is the sidebar and page, without a permanent full-width top toolbar. Existing native Zen controls and tabs are the implementation reference, not an imitation of a marketing page.

The inspectable targets are `target-closed.svg/png` and `target-open.svg/png`, at 1410 × 825. Page content is a representative extension-documentation reading task, not a browser-owned new-tab page. Letter marks in this drawing stand in for real cached website favicons. It does not claim running agents. The native page remains the site's own content.

Individual treatments:
- Dark neutral sidebar, 13px system labels, restrained selected fill, native window/navigation controls.
- 200 × 31 closed notch; 700px-wide open shelf; continuous curved shoulders in both states; small handle instead of unrelated decorative symbols.
- 124 × 104 pins with cached site icons. Folder silhouette with four contained previews. Nested navigation remains in the notch.
- One 16px stroke icon family for custom controls. Space emoji are only retained when chosen in the native space configuration.
- Task agents are narrow, diffuse coloured light; persistent agents have matte organic bodies while idle. Hover/focus describes saved state explicitly.
- Right panel prioritizes page context, selected text, editable task and persistence. No fabricated chat replies or tool traces.
- Selection actions align above the top-right corner; clamp at window edges. Shake and dock plus use the same small prompt.
- 220ms notch width transition with a quick reveal; no continuous idle animation. Respect reduced motion.

## Design review during implementation

Initial native defects: a blank URL toolbar row; duplicate bottom create button; Clear label; tiny Unicode agent rings; no closed-notch shoulders; arbitrary sparkle; cramped floating site pill; flat folder symbol; inconsistent icon weights.

First target critique: New Tab looked disabled and selected tab contrast was weak. Raised both in the implementation. A separate reviewer also raised the weak agent affordance; larger 38px hit areas, hover/focus surfaces and descriptive status tooltips address it. Suggestions to restore labeled category pills and make the notch float were rejected because they contradict the user's explicit icon-only spaces and attached-notch direction.

## State inventory

| Element | Important states / checks |
| --- | --- |
| Native sidebar | selected/unselected tab, pinned separator, New Tab, downloads, app menu, compact mode |
| Notch | closed/open, keyboard focus, outside click, Escape, narrow window |
| Pins | favicon, folder, nested breadcrumbs, empty folder, filtering, pin current page |
| Agents | saved task light, persistent matte body, hover/focus status, empty dock, add prompt |
| Context panel | page context, selection quote, task edit/resave, saved/error, private-window copy |
| Cursor | selection dwell, top-right alignment, edge clamping, prompt submit, Escape |
| Activity hook | permission-gated colour, strong tab blur, stop/reclaim; no execution backend yet |
| New Tab | retained native search overlay and keyboard navigation |

Native re-render and interaction coverage are recorded in VALIDATION.md. A target drawing and passing code checks are not visual verification of the implementation.

First native render evidence: `native-first-pass.jpg`, `native-notch-first-pass.jpg`, and `native-panel-first-pass.jpg`. These deliberately record the defects observed before the final fixes; they are not final acceptance screenshots.

Final review also identified native integration hazards: preserve URL-bar sizing while focused/open, and exclude the custom dock from toolbar widget customization. Both are corrected centrally. The final render remains pending on the locked Mac, as listed in VALIDATION.md.

## Design review — 2026-09-23

The native source-built app was rendered at 1410 × 825 with the actual MDN documentation page. The closed notch and 220px dark sidebar are close to the target proportions. The attached black shelf, round utilities, icon-only space switcher and horizontal cards are visible in the development profile; the source profile initially had no pins. Clicking near the physical notch shoulder opened the development shelf. The source-built shelf also opened through its native control.

The right agent panel has a clear page context, permission-gated read action, one actual tool event and an editable task. It truthfully shows that no model is connected. The task composer stays at the bottom while the activity timeline occupies the top; this leaves deliberate room for future events, though the one-event case is sparse. The visible tab glow ends with the read, so an extended-running fixture is needed to judge its active appearance.

The empty source shelf exposed a concrete defect: its 223px minimum height made a large vacant black area. Empty shelves now use a compact height while populated shelves keep the card dimensions. The final native re-render confirms both states, plus the folder breadcrumb state. Live website content includes MDN's own ads and hierarchy; the browser should not restyle that site merely to match the illustrative target.
