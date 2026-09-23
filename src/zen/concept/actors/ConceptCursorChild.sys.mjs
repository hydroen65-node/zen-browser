// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
import { ShakeDetector } from "resource:///modules/zen/concept/ConceptModel.sys.mjs";

export class ConceptCursorChild extends JSWindowActorChild {
  detector = new ShakeDetector();
  timer = null;
  lastMove = 0;
  handleEvent(event) {
    if (!event.isTrusted) return;
    if (event.type === "keyup" && event.key === "Escape") {
      this.contentWindow.clearTimeout(this.timer);
      return;
    }
    const focused = this.document.activeElement;
    if (
      focused?.isContentEditable ||
      focused?.matches?.("input,textarea,select")
    )
      return;
    const target = event.composedTarget || event.target;
    if (target?.isContentEditable || target?.closest?.("input,textarea,select"))
      return;
    if (event.type === "mousemove") {
      if (event.buttons || event.timeStamp - this.lastMove < 16) return;
      this.lastMove = event.timeStamp;
      if (this.detector.add(event.screenX, event.screenY, event.timeStamp)) {
        this.send("shake", event.screenX, event.screenY);
      }
    } else if (
      event.type === "mouseup" ||
      event.type === "keyup" ||
      event.type === "selectionchange"
    ) {
      this.contentWindow.clearTimeout(this.timer);
      this.timer = this.contentWindow.setTimeout(() => {
        const selection = this.contentWindow.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) {
          this.sendAsyncMessage("ConceptCursor:DismissSelection");
          return;
        }
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        this.send(
          "selection",
          this.contentWindow.mozInnerScreenX + rect.right,
          this.contentWindow.mozInnerScreenY + rect.top,
        );
      }, 400);
    }
  }
  send(kind, x, y) {
    const selection =
      this.contentWindow.getSelection()?.toString().trim().slice(0, 12000) ||
      "";
    if (kind === "selection" && !selection) return;
    this.sendAsyncMessage("ConceptCursor:Prompt", {
      kind,
      x,
      y,
      selection,
      title: this.document.title.slice(0, 300),
    });
  }
  didDestroy() {
    try {
      this.contentWindow?.clearTimeout(this.timer);
    } catch {}
  }
}
