// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * A bounded protocol between an agent harness and browser-owned tools.
 * The harness can request named tools, but only the trusted caller can run them.
 */
export class AgentRun {
  constructor({ invokeTool, onEvent = () => {} }) {
    if (typeof invokeTool !== "function" || typeof onEvent !== "function")
      throw new TypeError("Invalid agent run callbacks");
    this.invokeTool = invokeTool;
    this.onEvent = onEvent;
  }

  async run(steps, { signal } = {}) {
    if (!steps || typeof steps.next !== "function")
      throw new TypeError("Agent steps must be an async iterator");
    const ids = new Set();
    let events = 0;
    let calls = 0;
    let input;
    let lastToolResult;
    const checkCancelled = () => {
      if (signal?.aborted) throw new Error("Run cancelled");
    };
    const nextStep = async () => {
      checkCancelled();
      if (!signal) return steps.next(input);
      let abort;
      try {
        return await Promise.race([
          steps.next(input),
          new Promise((_, reject) => {
            abort = () => reject(new Error("Run cancelled"));
            signal.addEventListener("abort", abort, { once: true });
            if (signal.aborted) abort();
          }),
        ]);
      } finally {
        signal.removeEventListener("abort", abort);
      }
    };
    try {
      while (true) {
        const step = await nextStep();
        checkCancelled();
        if (step.done) {
          this.onEvent({ type: "run-ended", status: "completed" });
          return { status: "completed", lastToolResult };
        }
        if (++events > 32) throw new Error("Agent event limit reached");
        const request = step.value;
        if (!request || request.type !== "tool-call")
          throw new Error("Unknown agent event");
        if (
          typeof request.id !== "string" ||
          !/^[a-zA-Z0-9_-]{1,48}$/.test(request.id) ||
          ids.has(request.id)
        )
          throw new Error("Invalid or repeated tool request ID");
        if (request.name !== "browser.page.snapshot")
          throw new Error("Unknown browser tool");
        if (
          request.input != null &&
          (typeof request.input !== "object" ||
            Array.isArray(request.input) ||
            Object.keys(request.input).length)
        )
          throw new Error("This browser tool takes no input");
        if (++calls > 4) throw new Error("Agent tool limit reached");
        ids.add(request.id);
        this.onEvent({
          type: "tool-requested",
          id: request.id,
          name: request.name,
        });
        const response = await this.invokeTool(request.name, signal);
        checkCancelled();
        if (!response || !["completed", "denied"].includes(response.status))
          throw new Error("Invalid browser tool response");
        lastToolResult = response;
        this.onEvent({
          type: "tool-finished",
          id: request.id,
          name: request.name,
          status: response.status,
          characters:
            response.status === "completed" &&
            typeof response.result?.text === "string"
              ? response.result.text.length
              : 0,
        });
        if (response.status === "denied") {
          this.onEvent({ type: "run-ended", status: "denied" });
          return { status: "denied", lastToolResult };
        }
        input = response;
      }
    } catch (error) {
      this.onEvent({
        type: "run-ended",
        status:
          error.message === "Run cancelled" ||
          error.message === "Tool cancelled"
            ? "stopped"
            : "failed",
      });
      throw error;
    }
  }
}

/** A local fixture that exercises the same protocol without contacting a model. */
export async function* localPageInspection() {
  yield { type: "tool-call", id: "page", name: "browser.page.snapshot" };
}
