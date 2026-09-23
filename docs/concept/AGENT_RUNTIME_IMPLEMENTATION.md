# Agent runtime implementation contract

Status: implementation plan for bounded functionality work. The existing browser contains a local, read-only page inspection through `AgentRun` and `AgentToolGate`. It does **not** execute saved prompts with a model. UI form, material, motion, copy, and acceptance belong to `design/SIERRA_DESIGN_SYSTEM.md` and the main design pass.

Implemented foundation: `ConceptTaskState` is a pure, packaged run lifecycle, and the local page-read path now records queued, permission, running, and terminal transitions in memory. The current UI still keeps only a short local activity history; durable run-event storage, restart recovery, a real driver, and automatic execution remain future slices. The editable `draft` state belongs to the task record; a run begins at `saved` when created.

## Product boundary

An agent is one task record with an identity, an owning space, a current run, and a permission state. A task agent is ephemeral; a Hyper-Agent is a named persistent record with the same runtime and a persistence flag. The task runs independently of whether the panel is open. No page, tab, or task may claim an action occurred until the trusted browser bridge reports that it did.

The first end-to-end milestone is deliberately narrow: enter a prompt, start a run, make one read-only page-text request from a pinned tool list, show a truthful event stream, stop the run, and recover after a reload. It must not navigate, click, type, read passwords, use the host filesystem, or call a live model. A deterministic offline driver exercises the entire path. After that works, a real harness adapter can replace the driver without giving the harness browser privileges.

## Data and lifecycle

Keep `ConceptStore` profile-local and scoped by the Zen workspace UUID. Evolve its schema with a versioned migration; reject malformed records without erasing the original file. A task record needs `id`, `spaceId`, `name`, `prompt`, `persistent`, `color`, `source` (`url`, title, optional selection, captured tab identity), and `createdAt`/`updatedAt`. A run record needs `runId`, `taskId`, `spaceId`, `status`, bounded event summaries, and a last committed sequence number. Page text and credentials must not enter persistent event summaries.

Statuses are `draft`, `saved`, `queued`, `running`, `awaiting-permission`, `stopping`, `completed`, `failed`, and `cancelled`. Only the browser runner changes run status. A saved prompt alone remains `saved`; reopening the panel must not restart it. `queued` only means a real driver accepted it. `running` begins when the driver starts. `awaiting-permission` names the paused browser request and target tab. `stopping` immediately aborts in-flight work and revokes the claim; `cancelled` follows when the driver settles. A crash or browser restart changes an interrupted run to `failed` or a distinct recoverable interrupted state; it never silently resumes privileged actions.

Events have a monotonic sequence, wall time, kind, status, and a short user-facing summary. The event list is bounded by count and byte size. Persist completed/failed/cancelled transitions before the UI announces them. Page text may be passed to the harness in memory for a single request but is not stored in the trace. A model's reasoning text is not the activity stream; show concrete requested tools, permission waits, results, and user-visible response content.

## Trusted architecture

The content actor can collect bounded page title, URL, and DOM text from the selected browser. It cannot start agents, grant tab access, execute browser commands, or read chrome state. The privileged browser controller owns the task registry, ownership state, permission prompt, tool allowlist, and session references. A harness adapter receives a task prompt plus a scoped capability list and returns typed requests. It never receives `window`, `gBrowser`, `Services`, browser principals, arbitrary JS evaluation, passwords, or filesystem paths by default.

The adapter request union begins with `browser.page.snapshot` and an empty argument object. Every request carries `runId`, `requestId`, `taskId`, `spaceId`, and a monotonically increasing sequence. Reject unknown tools, arguments, duplicate IDs, excess calls, oversized strings, stale runs, and wrong spaces before looking up a tab. The browser binds a request to an ephemeral tab object and browsing context captured when the task starts; URLs and titles are presentation data, never tab identity. Revalidate the tab's owner window, selected/current state when required, workspace, browsing context, current URL, and user claim both before and after a tool call.

Use `AgentRun` as the protocol layer and `AgentToolGate` as the privileged dispatch boundary. Keep the pure protocol testable in Node and the chrome bridge thin. A future Codex/Claude harness process speaks a versioned local message protocol with explicit request/response IDs, bounded frames, timeouts, cancellation, and no arbitrary method dispatch. The bridge must survive a disconnected process without leaving tabs claimed. Do not start a local server exposed to the network merely to join the two processes; choose a host-local transport with an authenticated session and narrow file/socket permissions.

## Tab ownership and permission

The trusted state machine is `idle → awaiting-permission → agent-claimed → user-interrupt-requested → user-reclaimed`, with close/cancel/failure exits. A read of the user's active tab asks first. A separate agent-owned tab may have standing task-specific permission, but that grant never transfers to another task or workspace. A user click into an agent-controlled tab requests reclaim before any further tool step; taking over a tab the user is actively using requires a new explicit decision naming the agent, tab, and action. Denial returns a denied tool result and restores the previous UI state. Revocation aborts the in-flight operation and prevents its late result from reaching the harness.

Tab closure, navigation to a different document, workspace movement, private/public boundary change, task cancellation, window close, and driver disconnect all revoke or recheck ownership. Persist no direct tab object; after restart, the task may offer to reattach to a page but cannot inherit a previous browser permission. The active tab glow and dock glow derive only from `agent-claimed` plus work in progress, and disappear on every exit path.

## Browser tool roadmap

1. **Read-only local fixture:** current `browser.page.snapshot`, with bounded DOM text and real permission. Add tests for denial, navigation during read, tab close, cancellation, and stale response. The visible event shows “Read this page” and a character count or failure, never raw text by default.
2. **Navigation:** propose a URL and target tab. Browser validates HTTP/HTTPS, user/agent tab ownership, and origin transitions. Navigation emits start/commit/failure separately. It cannot silently move the user's active tab.
3. **Find/click/type:** use scoped element references minted from the current document, not arbitrary selectors supplied as trusted code. Revalidate document identity and visibility before acting. Password inputs and credential UI are excluded. User-facing trace names the action and site.
4. **Downloads and files:** sandboxed per-agent workspace with quotas and explicit export. Persistent Hyper-Agent isolation is a later measured decision. No full host path is passed to an agent without per-agent opt-in.
5. **Password broker:** native browser fills only an approved origin/form through a privileged boundary. The model never receives plaintext. Include a threat review for post-login page information before enabling this tool.

Watch and ad classification are independent DOM-first services and should not be smuggled into the agent tool runner as always-on screenshot access. Scheduled/reactive triggers enqueue ordinary agent runs with a trigger reason; they do not gain stronger permissions than a manually started run.

## Space memory

Each space has a bounded, versioned store shared by its agents. Reads and writes name the space and run; no cross-space fallback. Store user-approved facts or task artifacts with provenance and update time, not raw browsing history. Agents cannot silently turn the active page into memory. Private windows use ephemeral memory only. Every persistent write is auditable and removable by the user. Start with a local fixture and migration tests before connecting model-generated memory proposals.

## UI and design handoff

The agent panel is a floating browser sheet that can dock. The header carries the agent's name, body, status, Dock/Undock, and Close; its blank header area is draggable with no grip. Selection and page source stay compact and expandable. The activity trace is an ordered list of actual events. The composer stays accessible while a run is active, but submitting a follow-up is a state transition rather than an implicit restart. The dock body, tab light, and header trace share the agent's one color token. Persistent idle Hyper-Agent bodies are matte, while task-agent light remains blurred. The design owner reviews every state in Sierra Source at realistic width, including waiting, denied, reading, stopped, failed, completed, docked, narrow, and reduced motion.

Do not implement a fake chat response to fill an empty panel. If the model adapter is absent, state “Model not connected” and keep the local read tool clearly labelled as a local action. The first real rendered panel is a quality gate before repeating its components elsewhere.

## Delegation slices and acceptance

Functionality can be split into small nonoverlapping tasks after this contract is reviewed against the current code. A first slice is pure task/run state plus migration and offline tests. A second is the privileged controller and bounded event persistence. A third is the local harness adapter and disconnect/cancellation behavior. A fourth is a browser-tool expansion, one tool per slice, with explicit permission cases. UI wiring and visual decisions remain in the main thread.

For each slice, require a focused test of behavior and failure, a full UI build when chrome code changes, a packaged Sierra Source build for native changes, and a native check of the affected flow. Test fixtures use no paid model calls. A successful unit test cannot establish that the browser's tab, permission dialog, glow, and panel remain visually or functionally correct. Report unverified paths plainly.
