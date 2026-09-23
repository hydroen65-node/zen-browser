// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
import test from "node:test";
import assert from "node:assert/strict";
globalThis.JSWindowActorParent = class {};
globalThis.Services = { focus: { activeWindow: null } };
const { ConceptCursorParent } =
  await import("../../src/zen/concept/actors/ConceptCursorParent.sys.mjs");
function fixture() {
  const calls = [];
  const win = {
    gBrowser: { selectedBrowser: { browsingContext: { id: 1 } } },
    gBrowserConcept: { showCursorPrompt: (...args) => calls.push(args) },
  };
  Services.focus.activeWindow = win;
  const actor = new ConceptCursorParent();
  actor.browsingContext = { topChromeWindow: win, top: { id: 1 } };
  const message = {
    name: "ConceptCursor:Prompt",
    data: {
      kind: "selection",
      x: 120,
      y: 240,
      title: "Page",
      selection: "Selected text",
    },
  };
  return { calls, win, actor, message };
}
test("Cursor only opens for the active window and selected tab", () => {
  const { calls, win, actor, message } = fixture();
  actor.receiveMessage(message);
  assert.equal(calls.length, 1);
  actor.browsingContext.top.id = 2;
  actor.receiveMessage(message);
  assert.equal(calls.length, 1);
  actor.browsingContext.top.id = 1;
  Services.focus.activeWindow = {};
  actor.receiveMessage(message);
  assert.equal(calls.length, 1);
  Services.focus.activeWindow = win;
});
test("Cursor rejects malformed input and bounds text context", () => {
  const { calls, actor, message } = fixture();
  for (const data of [
    null,
    undefined,
    {},
    { kind: "selection", x: NaN, y: 0 },
    { kind: "execute", x: 0, y: 0 },
  ])
    actor.receiveMessage({ name: message.name, data });
  assert.equal(calls.length, 0);
  actor.receiveMessage({
    ...message,
    data: {
      ...message.data,
      selection: "x".repeat(20000),
      title: "t".repeat(1000),
    },
  });
  assert.equal(calls[0][0].selection.length, 12000);
  assert.equal(calls[0][0].title.length, 300);
});

test("collapsed selection dismisses suggestions only in the active selected tab", () => {
  const { win, actor } = fixture();
  let dismissed = 0;
  win.gBrowserConcept.hideCursorSelection = () => dismissed++;
  actor.receiveMessage({ name: "ConceptCursor:DismissSelection" });
  assert.equal(dismissed, 1);
  actor.browsingContext.top.id = 2;
  actor.receiveMessage({ name: "ConceptCursor:DismissSelection" });
  assert.equal(dismissed, 1);
  actor.browsingContext.top.id = 1;
  Services.focus.activeWindow = {};
  actor.receiveMessage({ name: "ConceptCursor:DismissSelection" });
  assert.equal(dismissed, 1);
});
