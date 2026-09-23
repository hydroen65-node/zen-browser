// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Pure task/run lifecycle state for the trusted browser runner.
 *
 * The state object owns no browser objects and performs no I/O. Create a run
 * with `createRun({ taskId, spaceId })`, move it with
 * `transition(runId, nextStatus, { summary })`, and add non-page-text
 * activity metadata with `appendEvent(runId, event)`. Mutations return a
 * detached snapshot, so a caller can persist it without exposing internal
 * state. Inject `now` and `runIdFactory` in offline tests for deterministic
 * results.
 */

export const TASK_STATUSES = Object.freeze([
  "saved",
  "queued",
  "running",
  "awaiting-permission",
  "stopping",
  "completed",
  "failed",
  "cancelled",
]);

const TRANSITIONS = {
  saved: ["queued"],
  queued: ["running", "stopping", "failed"],
  running: ["awaiting-permission", "stopping", "completed", "failed"],
  "awaiting-permission": ["running", "stopping", "failed"],
  stopping: ["cancelled", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
};

export const TASK_TRANSITIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(TRANSITIONS).map(([status, next]) => [
      status,
      Object.freeze([...next]),
    ]),
  ),
);

// Aliased name keeps the transition table easy to discover for callers.
export const VALID_TASK_TRANSITIONS = TASK_TRANSITIONS;

export const MAX_TASK_EVENTS = 64;
export const MAX_EVENT_SUMMARY_LENGTH = 240;
export const MAX_TASK_EVENT_BYTES = 16 * 1024;

let fallbackRunCounter = 0;

function utf8ByteLength(value) {
  if (typeof globalThis.TextEncoder === "function")
    return new globalThis.TextEncoder().encode(value).length;
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

function cloneRun(run) {
  return {
    runId: run.runId,
    taskId: run.taskId,
    spaceId: run.spaceId,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    lastSequence: run.lastSequence,
    events: run.events.map((event) => ({ ...event })),
  };
}

function requireIdentifier(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 128 ||
    /\s/.test(value)
  )
    throw new TypeError(`${label} IDs are required`);
}

function requireStatus(status) {
  if (!TASK_STATUSES.includes(status))
    throw new Error(`Unknown task status: ${String(status)}`);
}

function requireClockValue(value) {
  if (!Number.isFinite(value) || value < 0)
    throw new TypeError("Task timestamps must be finite numbers");
  return value;
}

function nextSequence(lastSequence, requested) {
  const sequence = requested === undefined ? lastSequence + 1 : requested;
  if (!Number.isSafeInteger(sequence) || sequence <= lastSequence)
    throw new Error("Event sequence must increase monotonically");
  return sequence;
}

/**
 * Generate a run ID. A caller that needs replayable IDs should inject a
 * `runIdFactory` into `ConceptTaskState`; this fallback is only for browser
 * runtime use and never encodes page content.
 */
export function createRunId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `run-${uuid}`;
  fallbackRunCounter += 1;
  return `run-${Date.now().toString(36)}-${fallbackRunCounter.toString(36)}`;
}

export class ConceptTaskState {
  constructor({
    now = () => Date.now(),
    runIdFactory = createRunId,
    maxEvents = MAX_TASK_EVENTS,
    maxSummaryLength = MAX_EVENT_SUMMARY_LENGTH,
    maxEventBytes = MAX_TASK_EVENT_BYTES,
  } = {}) {
    if (typeof now !== "function" || typeof runIdFactory !== "function")
      throw new TypeError("Task state callbacks must be functions");
    if (
      !Number.isSafeInteger(maxEvents) ||
      maxEvents < 1 ||
      !Number.isSafeInteger(maxSummaryLength) ||
      maxSummaryLength < 1 ||
      !Number.isSafeInteger(maxEventBytes) ||
      maxEventBytes < 1
    )
      throw new RangeError("Task state limits must be positive safe integers");
    this.now = now;
    this.runIdFactory = runIdFactory;
    this.maxEvents = maxEvents;
    this.maxSummaryLength = maxSummaryLength;
    this.maxEventBytes = maxEventBytes;
    this.runs = new Map();
  }

  createRun({ taskId, spaceId, runId = null } = {}) {
    requireIdentifier(taskId, "Task");
    requireIdentifier(spaceId, "Space");
    const id = runId || this.runIdFactory({ taskId, spaceId });
    requireIdentifier(id, "Run");
    if (this.runs.has(id)) throw new Error("Run ID already exists");
    const timestamp = requireClockValue(this.now());
    const run = {
      runId: id,
      taskId,
      spaceId,
      status: "saved",
      createdAt: timestamp,
      updatedAt: timestamp,
      lastSequence: 0,
      events: [],
      eventBytes: 0,
    };
    this.runs.set(id, run);
    return cloneRun(run);
  }

  hasRun(runId) {
    return this.runs.has(runId);
  }

  getRun(runId) {
    const run = this.runs.get(runId);
    return run ? cloneRun(run) : null;
  }

  listRuns() {
    return [...this.runs.values()].map(cloneRun);
  }

  transition(runId, nextStatus, { sequence, summary } = {}) {
    requireStatus(nextStatus);
    const run = this.#requireRun(runId);
    if (!TASK_TRANSITIONS[run.status].includes(nextStatus))
      throw new Error(
        `Invalid task status transition: ${run.status} -> ${nextStatus}`,
      );
    this.#appendEvent(run, {
      sequence,
      kind: "status",
      status: nextStatus,
      summary: summary ?? `Task ${nextStatus}`,
    });
    run.status = nextStatus;
    run.updatedAt = requireClockValue(this.now());
    return cloneRun(run);
  }

  appendEvent(runId, event = {}) {
    const run = this.#requireRun(runId);
    this.#appendEvent(run, event);
    run.updatedAt = requireClockValue(this.now());
    return cloneRun(run);
  }

  #requireRun(runId) {
    const run = this.runs.get(runId);
    if (!run) throw new Error("Unknown task run");
    return run;
  }

  #appendEvent(run, event) {
    if (!event || typeof event !== "object" || Array.isArray(event))
      throw new TypeError("Task event must be an object");
    for (const field of ["text", "pageText", "documentText", "result"])
      if (field in event)
        throw new Error("Page text cannot be stored in task events");
    const allowedFields = new Set([
      "sequence",
      "wallTime",
      "kind",
      "status",
      "summary",
    ]);
    const unknownField = Object.keys(event).find(
      (field) => !allowedFields.has(field),
    );
    if (unknownField)
      throw new Error(`Unknown task event field: ${unknownField}`);

    const sequence = nextSequence(run.lastSequence, event.sequence);
    const kind = event.kind ?? "activity";
    if (
      typeof kind !== "string" ||
      kind.length === 0 ||
      kind.length > 64 ||
      /\s/.test(kind)
    )
      throw new TypeError("Task event kind is invalid");
    const status = event.status ?? run.status;
    requireStatus(status);
    if (typeof event.summary !== "string")
      throw new TypeError("Task event summary is required");
    const summary = event.summary.trim();
    if (!summary.length) throw new TypeError("Task event summary is required");
    if (summary.length > this.maxSummaryLength)
      throw new Error("Event summary is too long");
    const wallTime = requireClockValue(event.wallTime ?? this.now());
    const candidate = { sequence, wallTime, kind, status, summary };
    const bytes = utf8ByteLength(JSON.stringify(candidate));
    if (run.events.length >= this.maxEvents)
      throw new Error("Event limit reached");
    if (run.eventBytes + bytes > this.maxEventBytes)
      throw new Error("Event byte limit reached");
    run.events.push(candidate);
    run.eventBytes += bytes;
    run.lastSequence = sequence;
  }
}
