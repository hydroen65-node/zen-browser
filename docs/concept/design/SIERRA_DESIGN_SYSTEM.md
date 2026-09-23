# Sierra interface system

Status: working design contract for the native fork. Every number below is a target to test in the real browser, not a claim that the current build already matches it. This document owns the visual direction; implementation plans may be delegated, but visual decisions and acceptance remain with the main design pass.

## Product task and hierarchy

Sierra is for reading and moving among real websites while keeping related tabs, spaces, and agents close at hand. The website must remain the dominant surface. Browser chrome should make three things easy to locate without creating a second dashboard: where the user is, which related pages are open, and what an agent is doing. Nothing should imply that a saved agent draft is executing.

The visual idea is **a page in an inset frame, with navigation embedded in the left edge and a black shelf cut into the top edge**. The shelf is the notch, not a top toolbar with a rounded rectangle placed over it. Agent controls appear as lightweight browser material at the right edge; docking is an explicit layout change, not a separate app window.

## Evidence and limits

| Source | Observed and useful | Transfer / limit |
| --- | --- | --- |
| User's Supaste reference, `codex-clipboard-6b209116-a7e3-4ba4-ab22-dfb517d0ea52.png` | Black shelf touches its parent top edge. Concave shoulders give it a cut-out silhouette; lower corners are round. Utility controls are compact circles. Search, navigation, then horizontally scrolling cards form one tight hierarchy. | Transfer the cut-out geometry, density, and card rhythm. Its preview imagery and category labels belong to a clipboard app, so Sierra uses favicons, space icons, and folder breadcrumbs. Reference dimensions are approximate because the image is a small crop. |
| User's three-page handwritten PDF, `HW 3 - 2026-09-20T15-35-12-166Z.pdf` | Sketches place manual folders and linked tabs in a sidebar, a small site logo/title bubble by the closed notch, space icons and pinned cards in the expanded notch, and an agent surface that can float or move to the right. | Treat these as design evidence; unclear handwriting and rough proportions are not implementation instructions. Preserve the later explicit request that folders open within the notch and the agent header drags without a visible handle. |
| [Arc Spaces](https://resources.arc.net/hc/en-us/articles/19228064149143-Spaces-Distinct-Browsing-Areas) and [Pinned Tabs](https://resources.arc.net/hc/en-us/articles/19231060187159-Pinned-Tabs-Tabs-you-want-to-stick-around) | Spaces carry icons and themes. Pinned tabs sit above a simple line; folders and ordinary tabs can both be pinned. | Keep the minimal separator and persistent tab behavior. Sierra switches spaces in the notch, and Trails are link-provenance relationships, not Arc's manual folders. Public help text establishes behavior, not exact pixels. |
| Zen source in this fork: `zen-theme.css`, `zen-browser-ui.css`, `zen-omnibox.css`, `ZenUIManager.mjs` | Zen already supplies per-space theme variables, an inset content canvas, native vertical tabs, and a floating URL-bar mode. The current concept CSS overrides those theme variables with fixed grey. | Reuse the actual theme and URL-bar mechanisms. Do not paint a second fixed theme on top of Zen or replace its navigation and accessibility internals. |
| Native Sierra Source render, 1410 × 878, September 23 | The address box remains visible at the top-left when inactive and focuses there for New Tab. The left site label overlaps page content near the black strip. Sidebar grey is unrelated to the current space; a small dark seam makes its content edge look cut short. The agent panel is a nearly full-height flat form with a large empty activity zone and large textarea. | These are defects to correct, not styling to preserve. Current screenshots are evidence only; earlier `target-closed/open` drawings also fail the new title-bubble and agent-sheet requirements. |

No proprietary Arc or Supaste icons, code, imagery, or type assets are copied. The reference comparison is at component and interaction level, using Sierra's native controls and suitably licensed source assets.

## Layout anatomy

At a 1410 × 825 usable window, the left sidebar is about 232 px, the page begins after one **continuous** 6–8 px side inset, and the page has a 10–12 px inner corner. The page starts around 40–44 px below the window top so the closed notch never covers real website controls; this is an empty safe frame, not a toolbar row with inputs or icons. Measure the actual Zen separation variable and match the left, right, and bottom gutters optically; do not add a second 1–2 px dark strip. The sidebar background and outer page gutter share the same theme-derived material. A hairline may separate them, but it must sit on the true edge instead of stopping short.

The notch is horizontally centered on the window/screen centerline, including in fullscreen, independent of a right agent panel. Its closed black cut-out is roughly 216 × 38 px, with 28 px concave shoulders that continue into the window's top edge and 18 px lower corners. It needs enough contrast against both a light and dark website to read as browser chrome. A 32 px transparent hit extension around the shoulder makes opening easy without changing its silhouette. There is no prominent decorative horizontal handle if it competes with the title bubble; the whole notch remains keyboard reachable with a clear accessible name.

A cached favicon, or a neutral globe fallback, occupies a compact 28–30 px badge immediately left of the closed notch. The **site title sits below the notch** in a small, centered bubble, with one-line truncation and a roughly 220 px maximum width. It is page identity, not an address field. Show it briefly after a tab change and on notch hover/focus, then let it fade so it cannot permanently cover a site's top navigation. The bubble should visually meet the notch through shared material/edge treatment. Clicking it focuses the native address/search popup. The closed state does not print the title in a loose strip to the left. Spaces are identified by icons when the notch opens.

The open notch is the same black cut-out expanded to a maximum width around 700 px. Inside folders its width follows the item count, down to a compact minimum around 360 px, so a one-item folder does not leave a huge empty shelf. It keeps the concave shoulders and lower-corner geometry; it must not become an ordinary floating modal. Top row: quiet search, pin current page, create folder, close. Second row: space icons only, with name on hover/focus. Inside folders this row becomes `space icon + Space > Folder > Folder`; opening a folder stays in the notch. The card strip uses 120–132 × 96–108 px cards with 8–10 px gaps, real favicons, and a concise label. Folder cards have a folder silhouette and four contained favicon previews. Empty folders collapse to a compact state. No instructional “drop tabs” copy.

## Surface and theme rules

Use Zen's live `--zen-primary-color`, `--zen-themed-toolbar-bg`, `--zen-main-browser-background`, and text variables as inputs. The sidebar and content gutter must respond when a space's theme changes. In dark mode, derive a low-chroma tinted sidebar from the space color mixed into a near-black neutral; use the accent at low strength for hover/selection and at higher strength only for real agent work. In light mode, preserve the same relationships with a light neutral base and tested text contrast. Do not set `--zen-primary-color` to a fixed grey in concept CSS.

The notch remains near-black across themes because its cut-out identity depends on it. Surrounding badges and agent material may pick up the space tint. “Glass” means a controlled translucent layer with enough opacity to keep text readable and a tested opaque fallback. Use backdrop blur only on the agent sheet or compact bubbles where it improves depth; do not blur the whole sidebar or webpage. Contrast should survive a bright photo, a dark website, and a tinted workspace.

| Token role | Provisional treatment | Purpose |
| --- | --- | --- |
| Browser frame | Theme-derived low-chroma surface | Joins sidebar and page gutter without a seam |
| Sidebar selected tab | Space tint at about 8–12% over frame, no heavy outline | Clear current position while preserving tab text |
| Divider | 1 px, low-opacity neutral, full usable width | Separates pinned structure from Trails with no labels |
| Notch | Near-black opaque, subtle edge highlight, soft lower shadow | Read as an actual top-edge cut-out |
| Agent floating sheet | Theme-aware dark/light elevated surface, 1 px edge, 18–22 px radius, restrained blur | Belongs to browser chrome without mimicking a chat app window |
| Agent docked panel | Same material, 10–14 px radius at the content edge, no shadow-heavy gap | Make docking feel continuous with the page frame |
| Agent light | Per-agent color in two diffuse layers with a narrow bright core | Identify task agents; glow only when work actually occurs |
| Hyper-Agent body | Soft irregular matte form while idle, same color family | Distinguish persistent identity without pretending it is active |

## Typography, iconography, and detail

Use the platform system family used by native Zen; verify the rendered font and weights in both builds. Browser chrome labels are 12–13 px, supporting metadata 10.5–11.5 px, and task text 13 px with 1.45–1.6 line height. Avoid a blanket opacity that makes every secondary control faint. A selected tab title must be readable at a glance; a clipped title uses ellipsis without cropping the icon. The title bubble shows a cleaned page title, not the full URL; full URL is available on hover and via the native address popup.

Custom icons use one 16 px outline family with round caps and about 1.6 px strokes. Filled website favicons are never forced into outline treatment. Match optical size, not only CSS dimensions: a folder's body needs more visual mass than a chevron. Close, dock, undock, pin, folder, and New Tab must each have clear labels for assistive technology. Do not use a drag-grip icon or visible positional indicators for the agent panel.

Default control corners are 6–8 px; tab rows around 9 px; pin cards 10–12 px; floating agent sheet 18–22 px. Radius follows containment: inner controls must be visibly tighter than their outer surface. A border is earned by depth or state change, not applied to every box. Check 1 px borders on standard and Retina scaling; if a border doubles optically, remove the duplicate layer rather than reducing its opacity.

### Working token scale

These are design targets, not universal CSS constants. Adjust an individual token only after comparing that element in the rendered browser and in its neighboring states.

| Role | Target | Test of correctness |
| --- | --- | --- |
| Hairline | 1 physical-looking CSS px at normal scale | It separates without drawing more attention than the selected tab. Check Retina and standard displays. |
| Core spacing | 4, 8, 12, 16, 24 px; 2 and 6 px for optical correction | A control's padding should relate to its hit size; equal numbers need not yield equal-looking gaps. |
| Small hit target | 30–34 px only inside dense chrome | Mouse works without crowding; keyboard focus outline remains visible. |
| Ordinary hit target | 38–44 px | Tabs, result rows, and popup actions do not feel miniature. |
| Compact text | 11–12 px | Secondary status remains readable at 100% zoom, not dimmed to near invisibility. |
| Main chrome text | 13 px | Tab titles and agent actions scan without competing with website headings. |
| Surface radii | 7, 10, 14, 20 px | Inner controls have less radius than enclosing cards and sheets. |
| Standard motion | 120–260 ms | The moving object remains trackable; no state waits on decoration. |

The first screen is intentionally quiet: website text and media carry the strongest detail. When many controls are visible together, reduce decorative weight before reducing information. A low-contrast separator is usually better than another titled container. Icons should be tested next to actual labels, not chosen from a gallery in isolation; if one icon needs a different stroke or optical center, correct that icon locally without inventing a second icon family.

The second full-window target, `sierra-photo-two-agents-target.svg` and `.png`, uses an original generated lake photograph as a fictional Field Notes page. It shows the settled closed notch, three ordinary tabs under two pinned items, a visible Trail, no popup or agent sheet, and two simultaneous working identities. The photo is a contrast test, not a browser wallpaper or a proposed replacement for sites. In design review, the blue and amber light should remain readable but softer than a selected-tab outline; the website image must retain its own color and visual priority. Do not infer that the target proves two real agent runs or working tab glow in the implementation.

### State and interaction grammar

Resting controls are legible but do not compete with the page. Hover adds one clear cue (a lightened fill or edge, not three effects). Pressed states deepen the same material and respond within roughly 80 ms. Focus-visible has a 2 px outline outside the hit area and never disappears into a colored workspace. Selected states persist independently of hover. Disabled controls use a readable reduced contrast plus a truthful explanation where the action is blocked; they must not look as if loading. Loading uses a progress indicator only when work actually exists. Error states state what failed and the next available action. Motion pauses or reverses cleanly when the user changes state midway.

For pointer hit testing, separate the visible geometry from its hit region where possible. The notch shoulder, small circle actions, and agent dock bodies can be easier to click without painting larger shapes. Native context menus and permission prompts remain accessible and keyboard operable. Escape closes the topmost transient surface first, then returns focus to its trigger; it should not silently erase unsaved task text.

## Sidebar: pinned items and Trails

The top group contains pinned tabs, folders, and nested structures. There is no “Pinned” heading. One horizontal divider separates it from regular Trails. Both pinned and unpinned tabs keep their real Zen tab behavior. Folder membership is manual and independent of Trail parentage.

A Trail is created only when a new tab comes from a link in an existing tab. The child appears immediately after its parent/subtree, indented by one level, connected by a fine rail. Opening a link from a nested child continues its provenance depth. A freestanding New Tab, address entry, or imported tab starts at the root; selecting or moving it does not silently adopt a folder or Trail. A pinned Trail keeps its descendants with it unless the user deliberately moves a child. Indent is roughly 16–18 px per level; after about three visible levels, keep text readable by allowing horizontal scroll or a compact depth marker. Do not shrink tab text indefinitely. A moved Trail retains its internal parent/child relationships in the destination space.

Selected, hovered, loading, muted, pinned, agent-working, and tab-closing states must be checked in both theme families. Working glow belongs to the tab background and adjacent edge, not the title text. The glow should be immediately visible, but it must stop when ownership is released. No continuous tab movement from AI sorting.

## New Tab and native search

Zen's replacement New Tab already opens the URL bar before making a tab. Keep the behavior, but Sierra's popup must appear as a centered, elevated search surface, never as an automatically highlighted box at the top-left of the sidebar. Use Zen's native floating URL-bar behavior where possible. The input is the primary action, with search-engine mode and ask-agent mode clearly distinct. Until an agent harness exists, “Ask agent” must lead to a truthful draft/prompt rather than claim a search answer.

The popup should have a 44–50 px input row, a 560–680 px max width, 10–14 px radius, and result rows with a 36–42 px hit height. It can appear near the upper-middle of the page where native Zen places its floating URL bar; it should not mask the physical notch. Escape closes it and restores the prior tab. Return opens a real page/tab. Cmd+L uses the same centered surface while preserving native location editing and browser security controls.

New Tab has two modes shown as compact adjacent choices below or inside the prompt edge: **Search** and **Ask agent**. Search uses the chosen engine and familiar result behavior; Ask agent makes a task prompt tied to the current space, with an honest saved/running state. The mode choice should be visible without a large explainer. The keyboard can switch modes, but ordinary typing keeps the current mode; no silent inference that a query is a task. When there is no connected model, Ask agent may save a task and explain that it has not started. Suggestions, history, and typed URLs should remain recognizable as native navigation, including the domain/security cue. Long URLs truncate in the results but can be inspected in the focused entry.

The first native New Tab render measured about 750 CSS px wide with oversized input type and loose result rows. That is more dominant than the website and broader than this target. A concept-specific width and type override is in progress; inspect the second render before treating the numbers above as settled.

## Agent presence, sheet, and conversation

The saved-agent dock remains integrated at the sidebar foot, using only light bodies, a plus action, and accessible hover/focus details. A task agent is a narrow diffuse light, never an emoji, circle, or hard blob. A Hyper-Agent can be a soft matte organic form while idle; it glows only while working. Distinct agent colors must remain distinguishable against the current space theme and not map all older agents to one fallback.

Opening an agent starts as a **floating sheet** near the right edge of the page, around 380–420 px wide and 450–500 px tall at desktop size. It has enough top/bottom offset to read as part of the browser surface, not a second full-height sidebar. The page does not resize in floating mode. A header button docks it with a 220–280 ms motion into a full-height right sidebar; undocking restores the prior floating position. Docked mode resizes the page once, cleanly, using the same gutter as the page frame. Resize and animation must be interruptible, must not trap the site at a narrow width, and must become a direct state change under reduced motion.

The **header surface itself** is draggable when floating, excluding buttons and editable elements. No grip, dots, arrows, or position labels are shown. Dragging clamps the sheet to the usable window and remembers the last floating position for this window. If the window shrinks, clamp again. Keyboard users get the Dock/Undock button and an accessible way to move focus into/out of the panel; dragging is optional, not the sole means of use.

The sheet's hierarchy is: compact agent identity/status and Dock/Close actions; one-line source page; activity/conversation body; compact task composer and action row. Do not reserve a huge blank transcript area above a giant textarea. Empty activity may use one quiet sentence. Tool calls show concise user-facing actions (“Read this page”), result state, and expandable details; internal tool IDs may remain in developer detail, not the main visual label. A saved draft is labeled saved. A local page read is labeled read; no fake AI response, reasoning trace, or autonomous animation.

The composer uses an 84–110 px starting height, grows to a capped maximum, and leaves room for activity. Primary action styling follows the theme and is active only for real actions. The copy should fit: “Save task,” “Inspect page,” “Stop,” “Dock,” “Undock,” and one short truthful connection note only when needed. Check source title truncation, selected text wrapping, denial, network/page read failure, cancellation, and re-opened saved drafts.

### Agent element specifications

| Element | Geometry and material | States and behavior |
| --- | --- | --- |
| Task light | About 26 × 28 px within a 36–40 px dock hit target; two soft color layers and a small bright core, no hard circular outline | Idle glow is low; active glow expands softly into the surrounding dock and tab. A saved draft has no work animation. Hover/focus shows name and true status. |
| Hyper-Agent body | Roughly 24–28 px irregular matte shape, recognizably different from the task light | Idle is non-glowing. Work adds a restrained peripheral glow without turning the body into a bright badge. |
| Agent tab | Native tab row remains readable; color blur fills its background and reaches slightly beyond the row | Only ownership-approved active work glows. Waiting permission and saved drafts do not glow. Reclaim, tab close, or cancellation removes it immediately. |
| Header | 36–40 px within the sheet, 16–20 px inset | Identity and status align first; Dock/Undock and Close sit at the far right. The header is the drag region in floating mode, without a visible grip. |
| Source row | One line, favicon 16 px, URL behind hover/help | If task context belongs to a different page than the selected tab, name the saved source rather than pretending the current page is in scope. |
| Selected text | A one-line disclosure with a 2 px left rule, 12 px type; expanded text scrolls after several lines | Long selections must not push the composer off-screen. Preserve the exact selected text behind the disclosure; never replace it with a fabricated summary. |
| Activity | Small section label, user-facing tool action, concise result, expandable details | Empty uses one quiet line. An actual read can show waiting for permission, reading, completed, stopped, or failed. No simulated thinking animation. |
| Composer | 84–110 px at rest, 10 px inner radius, clear text contrast | Expands while typing up to a safe fraction of window height. Save disabled for blank text. Draft survives Dock/Undock and drag. |
| Permission | Native browser dialog or anchored browser-owned surface | Distinguish read-only page text from control/takeover. State the agent name and target tab. Denial restores the previous activity state without changing the page. |

The agent body color is an identity token, not a decoration sprayed over every component. It belongs in the dock light, working tab, and a small header trace; task copy, tool text, and big panel surfaces stay neutral. Use the same hue with different luminosity for dark and light spaces. Avoid dark text directly on an agent glow. A breathing effect may use a slight radius/opacity change over roughly 2–3 seconds during actual work, with reduced motion disabling it; no moving particle cloud or repeated blur pulses on idle tabs.

### Cursor context

Selection suggestions appear at the highlighted text's **top-right corner** as a small floating strip above the range, falling below when there is no room. Width follows its two or three actions and never becomes a page-width toolbar. Keep it 6–8 px clear of the highlight; a subtle shadow and opaque enough backing preserve readability over photos and code. Actions should be verbs tied to the selection, such as “Explain” or “Ask agent,” with a short tooltip only if the label alone is unclear. Selection remains selected when the strip opens. A tiny AI button after a deliberate cursor shake opens the same prompt abstraction; it must not appear for ordinary tremor or while the user is dragging text. The prompt can open the floating agent sheet with the selected text and page as source. There is no separate Cursor agent system or unique task state.

The selection strip, shake button, and prompt are three different scales of the same control: a few immediate suggestions; a single discoverable trigger; then a task composer. The first two dismiss on Escape, selection collapse, navigation, or moving to another tab. Clamp them within the website viewport and keep them away from browser chrome. Check selections near top/right edges, multiline and right-to-left text, code blocks, zoomed pages, and rapid repeated shakes. A failed context capture should leave an empty editable prompt rather than claim the page was attached.

## Watch status and alert

Watch is an optional state of a named agent. Its always-visible status belongs in the top frame to the right of the closed notch when enough width exists, or in the sidebar foot at narrow width. The resting form is a one-line status phrase, for example “Reading JavaScript docs,” with a tiny agent-color marker. It should be shorter than a tab title and not become a second address bar. Hover or keyboard focus opens a compact 260–300 px explanation containing the goal, what Watch inferred from the current page's title/URL/text, and the last check time. Clicking gives a clear **Correct** action to change the inferred activity or pause Watch. If no local classifier is actually running, show “Watch paused” rather than a fabricated live summary.

After sustained off-task evidence, change the marker and edge to a warm alarm hue. A single quiet alert card says what was observed and offers “Stay on task,” “This is on task,” and “Pause Watch.” Do not cover the selected website text with a full-screen modal, shake the window, or use an endlessly pulsing red light. An alert can be dismissed and corrected; false-positive correction should affect subsequent status rather than merely hiding one message. Alarm hue never replaces text as the only signal. When the window is inactive, Watch may continue only according to its actual product setting; the UI must not imply background monitoring if none is occurring. Do not render a screenshot icon because Watch is DOM-text-based.

The status bubble must be tested alongside the title bubble, notch shoulders, narrow windows, full-screen video, a busy agent tab, and the browser's native permission prompts. Both Watch and agent activity can be present, but only the current alert receives alarm emphasis; the rest of the frame stays calm.

## Ad blocking controls

Network blocking, manual element removal, and novel-ad classification have separate status lines in one browser-owned control. A compact shield inside the open notch's utility row, or in an accessible overflow on narrow windows, shows the count of network requests blocked on this site only when that count is real. The default view gives **Blocking on this site** and a simple on/off control; any toggle states the scope and preserves the user's ability to undo it. Manual removal is a distinct **Pick an element** action. AI detection, when genuinely available, gets its own explicit status and does not claim that native filtering used AI.

Element picker mode keeps the page visible. Hover outlines the target with a 1–2 px high-contrast stroke and a restrained translucent fill, following the actual DOM box. The cursor remains precise; parent/child target stepping should be available by keyboard or small controls if needed. Clicking freezes a candidate and presents a small anchored confirmation surface with the site, a human-readable element hint, **Block element**, and **Cancel**. Optional selector details belong behind expansion, not in the main button. Highlight only what the pending rule would remove; if the selector matches multiple items, show the count before saving. After saving, show one short undo affordance. Escape cancels at every step, page navigation exits picker mode, and protected browser UI can never be selected.

The picker overlay is an interaction tool, not the ordinary visual theme. Its outline must survive dark/light pages, images, and CSS transforms without looking like a permanent agent glow. The blocked-element indicator should be silent at rest: a small shield status or count, never a badge on every removed region. If the rule fails after a reload, present the failed rule in the control instead of silently reporting success.

## Native chrome, menus, and responsive behavior

The browser's traffic lights and essential navigation remain native-sized. Do not leave orphaned Zen workspace controls beside Sierra's notch space switcher, yet retain Back, Forward, Reload, Downloads, site security, extension access, and keyboard navigation. Existing Zen settings and mods stay functional. The sidebar top row may contain essential navigation; it should not grow a separate address/search box. The New Tab button is visible in the tab list and its centered popup is the only focused address surface. Pinning tabs, native Zen folders, split view, and window controls must remain ordinary browser operations, not decorative replicas.

Context menus use native menu behavior where possible. If Sierra adds custom actions, keep row height about 28–32 px, icon size about 15–16 px, and menu width driven by the longest useful label rather than an arbitrary 300 px sheet. Group related actions with one quiet separator. Destructive actions name the target, and their red treatment appears only at the destructive row or confirmation. Position within the window; keyboard navigation and Escape work. Do not animate native menus merely to make the interface feel bespoke.

At 900 px window width, the site still needs a useful reading area, so floating agent width contracts and the notch stays within viewport. At about 760 px, the sidebar may enter its native compact/collapsed behavior; the badge, notch, and Watch status must not collide. At 540 px and below, a floating agent sheet can span the remaining window width with 8 px gutters; Dock may be unavailable if it would leave the page unusable, but the button must state why. In fullscreen, transient chrome yields to content and Escape retains its expected browser behavior. Test a bright photo site, a code-heavy documentation page, and a dark media page at 100% zoom; account for minimum supported window height so both the agent composer and its close action remain reachable.

## Copy and truthfulness

Names describe actions or current state in ordinary language. “Read this page” is clearer than an internal tool identifier; the identifier can live in expanded details. “Saved” means the task record was written, “Waiting for permission” means a real permission decision is pending, and “Working” requires an active runner. A task prompt is not a chat response. Avoid “AI is thinking,” fake typing dots, or cheerful success language for an unconnected model. Empty states say what can be done in one sentence at most; if the control itself explains the action, delete the sentence. Search, agent, Watch, and ad blocking failures must identify the affected item and a recovery path without blaming the user.

## Motion and interruption

Motion communicates state change. The notch expands from the top edge in about 190–230 ms with a controlled ease-out; card content fades/translates by only a few pixels after the shell begins expanding. The agent sheet docks/undocks over about 240 ms, with the page resize synchronized to it. Hover and pressed states resolve within about 100–140 ms. Agent glow may breathe slowly only during actual work; idle bodies remain still. No background shimmer.

Every movement must handle reverse input before completion, Escape, tab switching, window resize, and reduced-motion settings. Do not animate screenshot-like page content or move the user's tabs as a visual flourish. Use transforms/opacity where possible; geometry transitions may be used for the dock if they do not jank the live page. Test intermediate frames, not only final screenshots.

## Quality gates and coverage

### Element and state ledger

The ledger is a review queue, not a completion badge. For every row, inspect the actual source-built browser at normal size, then at a narrow size and in the relevant adjacent state. Review the icon silhouette, optical alignment, type, border, radius, color, hit area, focus treatment, copy, timing, interruption, and whether the control performs its named action. A passing unit test does not close a visual row.

| Surface | Required states and details to inspect | Current evidence / next decision |
| --- | --- | --- |
| Closed notch | Rest, hover, focus, title briefly visible, title hidden, light and dark site, compact sidebar. The 216 × 38 px black cut-out must meet the top edge; both concave shoulders must be continuous. Favicon badge is distinct from the site-title bubble. The 32 px invisible shoulder target must open the same shelf. | Top-edge geometry and favicon were seen in Sierra Dev. Recheck the Source package, title overlap/timing, focus ring, and narrow collision. If the black area reads as a pill, fix shoulder curvature before decorating it. |
| Open notch | Empty, one pin, crowded row, hover card, folder, two folders deep, keyboard focus, drag/drop, outside click and Escape. Check card crop, four-icon folder preview, breadcrumb truncation and hit size, and width transition. | Folder breadcrumb and smaller shelf were seen in Dev before the latest package. Source re-render pending. No drop instruction copy. Do not accept a folder page opening outside the notch. |
| Space switcher | Selected, hover/name tooltip, focus/name, long space name, alternate theme color. Icons must retain a common optical size while remaining individually recognizable. | Native root shelf was inspected once. Recheck tooltip and theme transition in Source; test whether a supplied emoji makes the row too tall. |
| Sidebar frame | Rest, selected, inactive window, two workspace colors, pinned separator, many tabs, compact/sidebar hidden. Compare exact gutter thickness at top, left and bottom, including Retina scaling. | The former grey/cutoff defect was corrected in Dev. Source and second space are pending. A selected tab must be clear without painting all tab rows. |
| Pinned tabs and folders | Pinned site, folder, nested item, pin/unpin, overflow, context menu, keyboard reorder, split view. Use the native Zen item and a single unlabelled divider. | Native upstream behavior exists; the full interaction and divider have not been accepted. Do not imply that a pinned bookmark card is the same as a persistent sidebar tab. |
| Trails | Root, child, grandchild, freely opened New Tab, manual folder intersection, moved space, restored session, closed parent, selected/hovered child. Verify one 17 px step and a thin continuous rail, then test text width at deep levels. | Parent linkage persisted in the tested Source session, but the child appeared flush with the root. This row is **open** until the visible rail and indent pass native review. |
| New Tab and address | Cmd+T, button, Cmd+L, URL, query, history result, Escape, empty input, keyboard focus. Measure width, type, row density and position relative to the physical notch. | Centered native popup was seen in Dev after removing the top-left field. Source interaction and the proposed Search/Ask mode control remain open. |
| Agent light and tab glow | Task light idle/active, Hyper-Agent matte idle/active, two simultaneous agent colors, active and background tab, permission wait, stop/reclaim. Glow belongs to a real owned run and must end promptly. | Idle lights and a local page-read path exist. No real in-flight native frame was captured; active intensity, timing and two-agent distinction remain open. |
| Agent sheet | Float, header drag, dock, undock, tab/space switch, resize, short/long title, empty history, actual tool event, denial, cancellation, saved draft, expanded selected text. Verify 20 px shell versus 9 px input radius, one-pixel border and readable secondary labels. | Floating and docked Dev states were seen. The first panel was too form-like; subsequent compact layout and selection disclosure require a fresh Source render. Drag could not be driven by the available native pointer tool. |
| Cursor | Selection near top-right, multi-line, code, RTL, zoom, collapsed selection, shake trigger, repeat shake and keyboard focus. The suggestion strip must sit 6–8 px from the selection and never cover the highlight. | Keyboard selection and dismissal were tested earlier. Placement across zoom/edges and a physical shake remain open. |
| Watch | Paused, real local activity, hover explanation, correction, sustained-alert, alert dismissal and reduced motion. Alarm must be readable without color. | Design contract only. Do not show a fabricated activity summary until the DOM classifier is actually running. |
| AdBlock | Site on/off, network count, element hover/selection/confirmation/undo, multiple matches, reload failure and keyboard target stepping. Picker outline must not be confused with agent glow. | Design contract only. Native blocking and picker flows have not been built or visually accepted. |
| Native chrome | Back/forward/reload, downloads, security cue, extension access, context menus, split view, fullscreen and window controls. Check Sierra branding and what Zen remnants remain. | Essential navigation was exercised. The macOS application menu still exposes upstream branding, and exhaustive Zen feature regression remains open. |

Resolve a row by recording a real screenshot or interaction and its remaining defect, then update the component rule if the rendered result disproves the target. Keep design decisions here; implementation notes live in the corresponding engineering contracts.

### Design review, native pass 1 (September 23)

At a maximized Retina Mac window with a live MDN page, the theme-derived sidebar and outer gutter now join without the earlier cutoff; the centered Zen address popup replaced the top-left highlighted field. The selected page favicon appears beside the closed notch, and the title bubble appears briefly below it after switching tabs. The page begins below the closed cut-out, so MDN navigation no longer sits behind it. This is a rendered observation in Sierra Dev, not acceptance for Sierra Source.

The first floating agent render still had a visually large selected-text quotation and an empty activity area; at 390 × 470 CSS px it nevertheless reads as an elevated browser sheet rather than a full-height app panel. Dock/undock was exercised natively and the page reflowed, but the docked view still needs a calmer empty state and motion-frame review. The open notch kept its top-edge silhouette and folder breadcrumbs, but a one-item folder left too much black space, so shelf width now follows the card count; that correction requires a second native render. The logo/title split is visually clear, although the temporary title bubble overlaps a website's uppermost navigation while shown. Check that overlap on a bright site and refine its timing/placement before calling it final. Inspect the real change in a second space color and at a narrow window before generalizing the material rules.

1. **First real screen:** MDN documentation, three tabs, one pinned folder, one child Trail, one saved agent. Capture closed notch, open notch, floating agent sheet, and docked sheet at a realistic Mac window. Compare against the user's Supaste crop and the current native baseline. If it looks like a toolbar plus bolted-on chat, revise the target before spreading rules.
2. **New Tab:** click the native button and use Cmd+T. Confirm the top-left search box never appears; type a search, use Escape, and navigate. Confirm native security/address behavior remains available.
3. **Sidebar/theming:** switch between at least two spaces with different colors and inspect the sidebar, gutter, selected tab, title bubble, and sheet. Check light/dark and inactive window. No grey hard-code or visible 1 px cutoff.
4. **Notch:** click center and near real-screen shoulder, open folder twice, use breadcrumbs, hover space icons, pin a real tab, test empty folder and narrow window. The card shelf must remain one continuous top-edge cut-out.
5. **Agent:** open from dock, drag by header, dock/undock repeatedly, resize window, switch tab/space, decline and approve a page read, stop an in-flight read when testable. Check all labels, geometry, materials, and motion frames.
6. **Trails:** open a link as a new tab from root and nested tab, open a freestanding new tab, pin a tab, make a manual folder, move a Trail between spaces, restore session, close parent, and test deep nesting/scroll.
7. **Before claiming finish:** inspect native rendered states in source and development builds, run relevant offline checks, perform a copy-deletion pass, record remaining unverified platform states. A passing build or this document alone is not visual acceptance.

Immediate correction order: theme and sidebar seam; native floating New Tab/search; favicon and title bubble; notch geometry/open states; floating/dockable agent sheet and composer; Trails presentation and provenance behavior. Revisit this order if a native render exposes a more fundamental flaw.
