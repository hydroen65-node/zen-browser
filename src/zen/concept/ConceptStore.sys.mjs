// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { AsyncShutdown } from "resource://gre/modules/AsyncShutdown.sys.mjs";

// One store and write queue per profile, shared across normal browser windows.
// Private windows never load or save through this module.
export const ConceptStore = {
  loading: null,
  data: { version: 1, spaces: {} },
  queue: Promise.resolve(),
  listeners: new Set(),
  async load() {
    this.loading ||= (async () => {
      AsyncShutdown.profileBeforeChange.addBlocker(
        "Save browser concept data",
        () => this.queue,
      );
      this.file = PathUtils.join(PathUtils.profileDir, "browser-concept.json");
      try {
        const data = await IOUtils.readJSON(this.file);
        if (
          data.version !== 1 ||
          !data.spaces ||
          Array.isArray(data.spaces) ||
          typeof data.spaces !== "object"
        )
          throw new Error("Unsupported concept store");
        for (const space of Object.values(data.spaces)) {
          if (!Array.isArray(space.items) || !Array.isArray(space.agents))
            throw new Error("Invalid space data");
        }
        const pending = Object.values(data.spaces).flatMap(
          (space) => space.items,
        );
        while (pending.length) {
          const item = pending.pop();
          if (
            !item ||
            typeof item.id !== "string" ||
            typeof item.name !== "string"
          )
            throw new Error("Invalid pinned item");
          if (item.type === "folder") {
            if (!Array.isArray(item.items)) throw new Error("Invalid folder");
            pending.push(...item.items);
          } else if (item.type !== "site" || typeof item.url !== "string")
            throw new Error("Invalid site");
        }
        for (const space of Object.values(data.spaces)) {
          for (const agent of space.agents) {
            if (
              !agent ||
              typeof agent.id !== "string" ||
              typeof agent.name !== "string" ||
              typeof agent.prompt !== "string" ||
              !agent.context ||
              typeof agent.context !== "object"
            )
              throw new Error("Invalid saved task");
          }
        }
        this.data = data;
      } catch (error) {
        // Do not silently replace an unreadable profile store with empty data.
        if (error.name !== "NotFoundError") throw error;
      }
      return this.data;
    })();
    return this.loading;
  },
  save() {
    const snapshot = JSON.parse(JSON.stringify(this.data));
    const write = this.queue.then(() =>
      IOUtils.writeJSON(this.file, snapshot, {
        tmpPath: this.file + ".tmp",
        permissions: 0o600,
      }),
    );
    this.queue = write.catch(() => {});
    for (const listener of this.listeners) listener();
    return write;
  },
};
