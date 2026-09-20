// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
export class ConceptCursorParent extends JSWindowActorParent {
  receiveMessage({ name, data }) {
    if (name !== "ConceptCursor:Prompt" || !data || typeof data !== "object")
      return;
    const win = this.browsingContext.topChromeWindow;
    const browser = win?.gBrowser?.selectedBrowser;
    if (
      !browser ||
      browser.browsingContext.id !== this.browsingContext.top.id ||
      Services.focus.activeWindow !== win
    )
      return;
    if (
      !["shake", "selection"].includes(data.kind) ||
      !Number.isFinite(data.x) ||
      !Number.isFinite(data.y)
    )
      return;
    // Selection is context only. A content-process message cannot start an agent or grant tab ownership.
    win.gBrowserConcept?.showCursorPrompt(
      {
        kind: data.kind,
        x: data.x,
        y: data.y,
        selection: String(data.selection).slice(0, 12000),
        title: String(data.title).slice(0, 300),
      },
      browser,
    );
  }
}
