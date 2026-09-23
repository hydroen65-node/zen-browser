import test from "node:test";
import assert from "node:assert/strict";
import { trailDepth } from "../../src/zen/concept/ConceptModel.sys.mjs";

test("a link from a child inherits its depth; a free tab stays root", () => {
  const root = { id: "root", parentId: "", spaceId: "home" };
  const child = { id: "child", parentId: "root", spaceId: "home" };
  const grandchild = { id: "grandchild", parentId: "child", spaceId: "home" };
  const free = { id: "free", parentId: "", spaceId: "home" };
  const byId = new Map(
    [root, child, grandchild, free].map((tab) => [tab.id, tab]),
  );
  assert.deepEqual(trailDepth(root, byId), { depth: 0, issue: null });
  assert.deepEqual(trailDepth(child, byId), { depth: 1, issue: null });
  assert.deepEqual(trailDepth(grandchild, byId), { depth: 2, issue: null });
  assert.deepEqual(trailDepth(free, byId), { depth: 0, issue: null });
});

test("missing, cross-space, and cyclic parents cannot create a visible Trail", () => {
  const root = { id: "root", parentId: "", spaceId: "home" };
  const moved = { id: "moved", parentId: "root", spaceId: "work" };
  const orphan = { id: "orphan", parentId: "closed", spaceId: "home" };
  const a = { id: "a", parentId: "b", spaceId: "home" };
  const b = { id: "b", parentId: "a", spaceId: "home" };
  const byId = new Map([root, moved, orphan, a, b].map((tab) => [tab.id, tab]));
  assert.deepEqual(trailDepth(moved, byId), { depth: 0, issue: "space" });
  assert.deepEqual(trailDepth(orphan, byId), { depth: 0, issue: "missing" });
  assert.deepEqual(trailDepth(a, byId), { depth: 0, issue: "cycle" });
});
