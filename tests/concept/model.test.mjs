import test from "node:test";
import assert from "node:assert/strict";
import {
  ShakeDetector,
  AgentOwnership,
  AgentToolGate,
  safeWebURL,
} from "../../src/zen/concept/ConceptModel.sys.mjs";

test("deliberate shake triggers once, then cools down", () => {
  const d = new ShakeDetector();
  const points = [100, 125, 95, 130, 90, 125];
  assert.equal(
    points.some((x, i) => d.add(x, 100, i * 55)),
    true,
  );
  assert.equal(
    points.some((x, i) => d.add(x, 100, 400 + i * 55)),
    false,
  );
});
test("ordinary movement, jitter, and slow oscillation do not trigger", () => {
  for (const points of [
    Array.from({ length: 12 }, (_, i) => [i * 20, i * 40]),
    Array.from({ length: 12 }, (_, i) => [100 + (i % 3), i * 20]),
    Array.from({ length: 12 }, (_, i) => [100 + (i % 2) * 30, i * 400]),
  ]) {
    const d = new ShakeDetector();
    assert.equal(
      points.some(([x, t]) => d.add(x, 100, t)),
      false,
    );
  }
});
test("active tab requires explicit matching permission; reclaim revokes immediately", () => {
  const m = new AgentOwnership();
  assert.equal(
    m.request("t", "a", "home", { active: true }).state,
    "awaiting-permission",
  );
  assert.throws(() => m.assertAllowed("t", "a", "home"));
  assert.throws(() => m.allow("t", "other"));
  m.allow("t", "a");
  m.assertAllowed("t", "a", "home");
  assert.throws(() => m.assertAllowed("t", "a", "work"));
  m.reclaim("t");
  assert.throws(() => m.assertAllowed("t", "a", "home"));
});
test("agents cannot steal each other’s tabs; closed tabs release ownership", () => {
  const m = new AgentOwnership();
  m.request("t", "a", "home");
  assert.throws(() => m.request("t", "b", "home"));
  m.close("t");
  assert.equal(m.request("t", "b", "home").state, "agent-claimed");
});
test("browser pins reject executable, file, and internal URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "about:config",
    "data:text/html,x",
  ])
    assert.equal(safeWebURL(url), null);
  assert.equal(safeWebURL("https://example.com"), "https://example.com/");
});

test("repeated claims cannot bypass consent or move a claim across spaces", () => {
  const ownership = new AgentOwnership();
  ownership.request("tab", "agent", "home", { active: true });
  assert.equal(
    ownership.request("tab", "agent", "home").state,
    "awaiting-permission",
  );
  assert.throws(() => ownership.assertAllowed("tab", "agent", "home"));
  assert.throws(() => ownership.request("tab", "agent", "work"));
  ownership.allow("tab", "agent");
  ownership.assertAllowed("tab", "agent", "home");
});

test("browser tool asks once for active-tab control and releases it", async () => {
  const ownership = new AgentOwnership();
  const tab = {};
  const calls = [];
  const gate = new AgentToolGate(ownership, async (tool, candidate) => {
    ownership.assertAllowed(candidate, "agent", "space");
    calls.push(tool);
    return { title: "Page", text: "Text" };
  });
  const result = await gate.invoke({
    agentId: "agent",
    spaceId: "space",
    tab,
    active: true,
    tool: "browser.page.snapshot",
    authorize: async () => {
      calls.push("consent");
      return true;
    },
    isCurrent: () => true,
    onAuthorized: () => calls.push("working"),
  });
  assert.deepEqual(calls, ["consent", "working", "browser.page.snapshot"]);
  assert.equal(result.status, "completed");
  assert.throws(() => ownership.assertAllowed(tab, "agent", "space"));
});

test("browser tool denies work and rejects stale or unknown requests", async () => {
  const ownership = new AgentOwnership();
  let performed = 0;
  const gate = new AgentToolGate(ownership, async () => {
    performed++;
  });
  const base = {
    agentId: "agent",
    spaceId: "space",
    tab: {},
    active: true,
    tool: "browser.page.snapshot",
    authorize: async () => false,
    isCurrent: () => true,
  };
  assert.equal((await gate.invoke(base)).status, "denied");
  assert.equal(performed, 0);
  await assert.rejects(() =>
    gate.invoke({ ...base, tool: "browser.chrome.eval" }),
  );
  await assert.rejects(() => gate.invoke({ ...base, isCurrent: () => false }));
  assert.equal(performed, 0);
  assert.equal(ownership.tabs.size, 0);
});

test("browser tool rechecks context after consent", async () => {
  const ownership = new AgentOwnership();
  let current = true;
  const gate = new AgentToolGate(ownership, async () =>
    assert.fail("stale work"),
  );
  const tab = {};
  await assert.rejects(() =>
    gate.invoke({
      agentId: "agent",
      spaceId: "space",
      tab,
      active: true,
      tool: "browser.page.snapshot",
      authorize: async () => {
        current = false;
        return true;
      },
      isCurrent: () => current,
    }),
  );
  assert.equal(ownership.tabs.size, 0);
});

test("browser tool discards a result when the page changes during the read", async () => {
  const ownership = new AgentOwnership();
  const tab = {};
  let current = true;
  const gate = new AgentToolGate(ownership, async () => {
    current = false;
    return { text: "Previous page" };
  });
  await assert.rejects(() =>
    gate.invoke({
      agentId: "agent",
      spaceId: "space",
      tab,
      active: true,
      tool: "browser.page.snapshot",
      authorize: async () => true,
      isCurrent: () => current,
    }),
  );
  assert.equal(ownership.tabs.size, 0);
});
