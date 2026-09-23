// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
globalThis.JSWindowActorChild = class {};
globalThis.ShakeDetector = class {};
const actorSource = (
  await readFile(
    new URL(
      "../../src/zen/concept/actors/ConceptCursorChild.sys.mjs",
      import.meta.url,
    ),
    "utf8",
  )
).replace(/^import \{ ShakeDetector \} from .*;\n/m, "");
const { ConceptCursorChild } = await import(
  "data:text/javascript;base64," + Buffer.from(actorSource).toString("base64")
);

test("page snapshot stays inside a bounded text-only result", () => {
  const actor = new ConceptCursorChild();
  actor.document = {
    title: "T".repeat(400),
    location: { href: "https://example.com/article" },
    body: { innerText: "A".repeat(10000) },
  };
  const snapshot = actor.receiveMessage({ name: "ConceptCursor:Snapshot" });
  assert.deepEqual(Object.keys(snapshot), ["title", "url", "text"]);
  assert.equal(snapshot.title.length, 300);
  assert.equal(snapshot.text.length, 6000);
  assert.equal(snapshot.url, "https://example.com/article");
  assert.equal(actor.receiveMessage({ name: "ConceptCursor:RunScript" }), null);
});
