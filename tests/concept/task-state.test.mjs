import test from "node:test";
import assert from "node:assert/strict";
import {
  ConceptTaskState,
  TASK_STATUSES,
} from "../../src/zen/concept/ConceptTaskState.sys.mjs";

function state(options = {}) {
  return new ConceptTaskState({
    now: () => 1_700_000_000_000,
    runIdFactory: () => "run-fixed",
    ...options,
  });
}

test("creates a saved run with a stable run ID", () => {
  const tasks = state();
  const run = tasks.createRun({ taskId: "task-1", spaceId: "home" });

  assert.equal(run.runId, "run-fixed");
  assert.equal(run.taskId, "task-1");
  assert.equal(run.spaceId, "home");
  assert.equal(run.status, "saved");
  assert.equal(run.lastSequence, 0);
  assert.deepEqual(run.events, []);

  const copy = tasks.getRun(run.runId);
  copy.status = "running";
  assert.equal(tasks.getRun(run.runId).status, "saved");
});

test("accepts the documented lifecycle transitions and records ordered summaries", () => {
  const tasks = state();
  const run = tasks.createRun({ taskId: "task-1", spaceId: "home" });

  tasks.transition(run.runId, "queued", { summary: "Queued" });
  tasks.transition(run.runId, "running", { summary: "Started" });
  tasks.transition(run.runId, "awaiting-permission", {
    summary: "Waiting for permission",
  });
  tasks.transition(run.runId, "running", { summary: "Permission granted" });
  tasks.transition(run.runId, "stopping", { summary: "Stopping" });
  const cancelled = tasks.transition(run.runId, "cancelled", {
    summary: "Stopped",
  });

  assert.deepEqual(
    cancelled.events.map((event) => [event.sequence, event.status]),
    [
      [1, "queued"],
      [2, "running"],
      [3, "awaiting-permission"],
      [4, "running"],
      [5, "stopping"],
      [6, "cancelled"],
    ],
  );
  assert.equal(cancelled.lastSequence, 6);
  assert.ok(TASK_STATUSES.includes(cancelled.status));
});

test("rejects invalid and terminal transitions without mutating the run", () => {
  const tasks = state();
  const run = tasks.createRun({ taskId: "task-1", spaceId: "home" });

  assert.throws(
    () => tasks.transition(run.runId, "running"),
    /Invalid task status transition/,
  );
  tasks.transition(run.runId, "queued");
  tasks.transition(run.runId, "running");
  tasks.transition(run.runId, "completed");
  const complete = tasks.getRun(run.runId);

  assert.throws(
    () => tasks.transition(run.runId, "stopping"),
    /Invalid task status transition/,
  );
  assert.deepEqual(tasks.getRun(run.runId), complete);
});

test("rejects duplicate or out-of-order event sequences", () => {
  const tasks = state();
  const run = tasks.createRun({ taskId: "task-1", spaceId: "home" });
  tasks.transition(run.runId, "queued", { sequence: 4 });

  for (const sequence of [4, 3, 0]) {
    assert.throws(
      () =>
        tasks.appendEvent(run.runId, {
          sequence,
          kind: "tool-requested",
          status: "queued",
          summary: "Read this page",
        }),
      /Event sequence must increase monotonically/,
    );
  }
  assert.equal(tasks.getRun(run.runId).lastSequence, 4);
});

test("bounds event count and summaries and rejects page-text fields", () => {
  const tasks = state({
    maxEvents: 2,
    maxSummaryLength: 12,
    maxEventBytes: 600,
  });
  const run = tasks.createRun({ taskId: "task-1", spaceId: "home" });

  tasks.transition(run.runId, "queued", { summary: "Queued" });
  assert.throws(
    () =>
      tasks.appendEvent(run.runId, {
        kind: "tool-requested",
        status: "queued",
        summary: "This summary is too long",
      }),
    /Event summary is too long/,
  );
  assert.throws(
    () =>
      tasks.appendEvent(run.runId, {
        kind: "tool-requested",
        status: "queued",
        summary: "Read this page",
        pageText: "Private page text must not be stored",
      }),
    /Page text cannot be stored in task events/,
  );
  tasks.appendEvent(run.runId, {
    kind: "tool-requested",
    status: "queued",
    summary: "Read page",
  });
  assert.throws(
    () =>
      tasks.appendEvent(run.runId, {
        kind: "tool-finished",
        status: "queued",
        summary: "Done",
      }),
    /Event limit reached/,
  );

  const byteBounded = state({ maxEventBytes: 150 });
  const byteRun = byteBounded.createRun({ taskId: "task-2", spaceId: "home" });
  byteBounded.transition(byteRun.runId, "queued", { summary: "Queued" });
  assert.throws(
    () =>
      byteBounded.appendEvent(byteRun.runId, {
        kind: "tool-requested",
        status: "queued",
        summary: "Read page",
      }),
    /Event byte limit reached/,
  );
});

test("rejects unknown statuses, malformed runs, and duplicate run IDs", () => {
  const tasks = state();
  tasks.createRun({ taskId: "task-1", spaceId: "home" });

  assert.throws(
    () =>
      tasks.createRun({
        taskId: "task-2",
        spaceId: "home",
        runId: "run-fixed",
      }),
    /Run ID already exists/,
  );
  assert.throws(
    () => tasks.transition("missing", "queued"),
    /Unknown task run/,
  );
  assert.throws(
    () => tasks.createRun({ taskId: "", spaceId: "home" }),
    /Task IDs are required/,
  );
  assert.throws(
    () => tasks.transition("run-fixed", "draft"),
    /Unknown task status/,
  );
});
