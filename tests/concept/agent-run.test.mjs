import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentRun,
  localPageInspection,
} from "../../src/zen/concept/AgentRun.sys.mjs";

test("local page inspection emits bounded activity and returns the tool result", async () => {
  const events = [];
  const calls = [];
  const run = new AgentRun({
    invokeTool: async (name) => {
      calls.push(name);
      return { status: "completed", result: { title: "Page", text: "Hello" } };
    },
    onEvent: (event) => events.push(event),
  });
  const result = await run.run(localPageInspection());
  assert.deepEqual(calls, ["browser.page.snapshot"]);
  assert.equal(result.status, "completed");
  assert.equal(result.lastToolResult.result.text, "Hello");
  assert.deepEqual(
    events.map((event) => event.type),
    ["tool-requested", "tool-finished", "run-ended"],
  );
  assert.equal(events[1].characters, 5);
  assert.equal(events[2].status, "completed");
  assert.equal(JSON.stringify(events).includes("Hello"), false);
});

test("denied consent stops the run before another requested tool", async () => {
  let calls = 0;
  async function* steps() {
    yield { type: "tool-call", id: "first", name: "browser.page.snapshot" };
    yield { type: "tool-call", id: "second", name: "browser.page.snapshot" };
  }
  const events = [];
  const run = new AgentRun({
    invokeTool: async () => {
      calls++;
      return { status: "denied" };
    },
    onEvent: (event) => events.push(event),
  });
  assert.equal((await run.run(steps())).status, "denied");
  assert.equal(calls, 1);
  assert.equal(events.at(-1).status, "denied");
});

test("tool result reaches the harness, while the visible trace keeps only metadata", async () => {
  let seen;
  async function* steps() {
    seen = yield {
      type: "tool-call",
      id: "page",
      name: "browser.page.snapshot",
    };
  }
  const events = [];
  const run = new AgentRun({
    invokeTool: async () => ({
      status: "completed",
      result: { text: "Private page content" },
    }),
    onEvent: (event) => events.push(event),
  });
  await run.run(steps());
  assert.equal(seen.result.text, "Private page content");
  assert.equal(JSON.stringify(events).includes("Private page content"), false);
});

test("harness cannot request unlisted tools or pass tool arguments", async () => {
  let calls = 0;
  const run = new AgentRun({ invokeTool: async () => calls++ });
  async function* unknown() {
    yield { type: "tool-call", id: "one", name: "browser.chrome.eval" };
  }
  async function* argument() {
    yield {
      type: "tool-call",
      id: "one",
      name: "browser.page.snapshot",
      input: { url: "https://example.com" },
    };
  }
  await assert.rejects(run.run(unknown()), /Unknown browser tool/);
  await assert.rejects(run.run(argument()), /takes no input/);
  assert.equal(calls, 0);
});

test("run rejects duplicate tool IDs and excessive tool requests", async () => {
  const run = new AgentRun({
    invokeTool: async () => ({ status: "completed", result: { text: "" } }),
  });
  async function* duplicate() {
    yield { type: "tool-call", id: "same", name: "browser.page.snapshot" };
    yield { type: "tool-call", id: "same", name: "browser.page.snapshot" };
  }
  async function* excess() {
    for (let i = 0; i < 5; i++)
      yield {
        type: "tool-call",
        id: `tool_${i}`,
        name: "browser.page.snapshot",
      };
  }
  await assert.rejects(run.run(duplicate()), /repeated tool request ID/);
  await assert.rejects(run.run(excess()), /tool limit reached/);
});

test("cancellation while the harness waits does not invoke a tool", async () => {
  const controller = new AbortController();
  let calls = 0;
  async function* waiting() {
    await new Promise(() => {});
    yield { type: "tool-call", id: "page", name: "browser.page.snapshot" };
  }
  const events = [];
  const run = new AgentRun({
    invokeTool: async () => calls++,
    onEvent: (event) => events.push(event),
  });
  const pending = run.run(waiting(), { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /Run cancelled/);
  assert.equal(calls, 0);
  assert.deepEqual(events.at(-1), { type: "run-ended", status: "stopped" });
});

test("cancellation during a tool call cannot produce a completed event", async () => {
  const controller = new AbortController();
  let started;
  const toolStarted = new Promise((resolve) => (started = resolve));
  const events = [];
  const run = new AgentRun({
    invokeTool: async (_, signal) => {
      started();
      await new Promise((_, reject) =>
        signal.addEventListener(
          "abort",
          () => reject(new Error("Tool cancelled")),
          { once: true },
        ),
      );
    },
    onEvent: (event) => events.push(event),
  });
  const pending = run.run(localPageInspection(), { signal: controller.signal });
  await toolStarted;
  controller.abort();
  await assert.rejects(pending, /Tool cancelled/);
  assert.deepEqual(
    events.map((event) => event.type),
    ["tool-requested", "run-ended"],
  );
  assert.equal(events.at(-1).status, "stopped");
});
