# Browser fork working rules

Read `docs/concept/FOUNDATION.md` and `docs/concept/VALIDATION.md` before continuing. Treat the source tree as a Zen downstream fork, not a blank browser implementation.

- Preserve upstream features unless they directly conflict with the current browser specification. Prefer native Zen mechanisms for tabs, spaces, manual folders, split view, extensions, navigation, sessions and settings.
- Keep the installed Zen app and ordinary profiles separate from development. Use `scripts/build-concept-dev.py` and the dedicated development launcher for UI work. Quit the dev process completely before rebuilding its bundle.
- Development UI overlays are not full Gecko builds. Report the actual engine and tests used. Do not imply that drafts, glow effects or static panels are executing agents.
- Keep concept enablement explicit during development. Agent tool execution must check trusted ownership/consent on every action. Web content and model output cannot grant permission, choose privileged chrome code or receive plaintext credentials.
- Treat the user's product specification as the intended roadmap, not a list of completed features. Follow the current corrections: dark theme, stronger agent activity blur, selection actions at the highlighted text's top-right, small shake prompt, notch-contained folders with breadcrumbs and minimal native sidebar labels.
- Apply avoid-tasteslop for design changes. Include Taste design before visual work and Design review during and before completion; inspect actual native renders and affected interactions.
- Keep communication plain and concise. Resolve routine technical choices without asking the user to approve implementation details.
- Run focused local tests and inspect real UI states. No live AI calls for routine tests. Keep cloud usage, CI, downloads and builds bounded; never enable paid overages or upstream release workflows without authorization. Actions are intentionally disabled on the fork for now.
- Never commit profile data, logs, credentials, engine binaries or local build artifacts. Retain MPL headers and upstream attribution.
