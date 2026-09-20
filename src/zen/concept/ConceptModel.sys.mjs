// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/** Pure logic shared by the privileged browser UI and offline tests. */
export class ShakeDetector {
  constructor() {
    this.points = [];
    this.lastTrigger = -Infinity;
  }
  add(x, y, time) {
    if (![x, y, time].every(Number.isFinite)) return false;
    if (time - this.lastTrigger < 1800) return false;
    this.points = this.points.filter((p) => time - p.time <= 650);
    const last = this.points.at(-1);
    if (last && Math.hypot(x - last.x, y - last.y) < 6) return false;
    this.points.push({ x, y, time });
    if (this.points.length < 6) return false;
    const xs = this.points.map((p) => p.x),
      ys = this.points.map((p) => p.y);
    if (
      Math.max(...xs) - Math.min(...xs) > 180 ||
      Math.max(...ys) - Math.min(...ys) > 180
    )
      return false;
    const axis =
      Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys)
        ? "x"
        : "y";
    let direction = 0,
      reversals = 0,
      distance = 0;
    for (let i = 1; i < this.points.length; i++) {
      const delta = this.points[i][axis] - this.points[i - 1][axis];
      if (Math.abs(delta) < 8) continue;
      distance += Math.abs(delta);
      const next = Math.sign(delta);
      if (direction && next !== direction) reversals++;
      direction = next;
    }
    if (reversals < 4 || distance < 100) return false;
    this.lastTrigger = time;
    this.points = [];
    return true;
  }
}

export class AgentOwnership {
  constructor() {
    this.tabs = new Map();
  }
  request(tabId, agentId, spaceId, { active = false } = {}) {
    const existing = this.tabs.get(tabId);
    if (existing) {
      if (existing.agentId !== agentId || existing.spaceId !== spaceId)
        throw new Error("Tab already claimed");
      return { ...existing };
    }
    const entry = {
      tabId,
      agentId,
      spaceId,
      state: active ? "awaiting-permission" : "agent-claimed",
    };
    this.tabs.set(tabId, entry);
    return { ...entry };
  }
  allow(tabId, agentId) {
    const entry = this.tabs.get(tabId);
    if (
      !entry ||
      entry.agentId !== agentId ||
      entry.state !== "awaiting-permission"
    )
      throw new Error("No matching permission request");
    entry.state = "agent-claimed";
    return { ...entry };
  }
  assertAllowed(tabId, agentId, spaceId) {
    const entry = this.tabs.get(tabId);
    if (
      !entry ||
      entry.state !== "agent-claimed" ||
      entry.agentId !== agentId ||
      entry.spaceId !== spaceId
    )
      throw new Error("Tab control is not authorized");
  }
  reclaim(tabId) {
    const entry = this.tabs.get(tabId);
    this.tabs.delete(tabId);
    return entry && { ...entry, state: "user-reclaimed" };
  }
  close(tabId) {
    this.tabs.delete(tabId);
  }
}

export function safeWebURL(raw) {
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
