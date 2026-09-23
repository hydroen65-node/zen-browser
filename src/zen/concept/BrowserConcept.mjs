// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
import {
  safeWebURL,
  trailDepth,
  AgentOwnership,
  AgentToolGate,
} from "resource:///modules/zen/concept/ConceptModel.sys.mjs";

import { ConceptStore } from "resource:///modules/zen/concept/ConceptStore.sys.mjs";
import { SessionStore } from "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs";
import {
  AgentRun,
  localPageInspection,
} from "resource:///modules/zen/concept/AgentRun.sys.mjs";
import { ConceptTaskState } from "resource:///modules/zen/concept/ConceptTaskState.sys.mjs";

const HTML = "http://www.w3.org/1999/xhtml";
class BrowserConcept {
  constructor(win) {
    this.win = win;
    this.doc = win.document;
    this.path = [];
    this.onEvent = this.handleEvent.bind(this);
    this.ownership = new AgentOwnership();
    this.runningTools = new Map();
    this.toolHistory = new Map();
    this.taskState = new ConceptTaskState();
    this.toolGate = new AgentToolGate(this.ownership, (tool, tab) =>
      this.performBrowserTool(tool, tab),
    );
    this.data = { version: 1, spaces: {} };
  }
  node(tag, className, text) {
    const node = this.doc.createElementNS(HTML, tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  button(text, label, action, className = "") {
    const b = this.node("button", className, text);
    b.type = "button";
    b.title = label;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", action);
    return b;
  }
  icon(name) {
    const paths = {
      home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
      search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
      plus: "M12 5v14M5 12h14",
      close: "m6 6 12 12M6 18 18 6",
      dock: "M3 4h18v16H3zM15 4v16",
      folder:
        "M3 7V5a1 1 0 0 1 1-1h6l3 3h7a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z",
      star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9L7.5 14 3 9.6l6.2-.9Z",
      chevron: "m9 5 7 7-7 7",
      arrow: "M12 20V4m-6 6 6-6 6 6",
      briefcase: "M8 7V4h8v3M3 7h18v13H3ZM3 12h18M10 12v3h4v-3",
      leaf: "M5 19C0 8 11 3 21 3c0 10-5 21-16 16Zm0 0L16 8",
      grid: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
      globe:
        "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2c3 3 4 6 4 10s-1 7-4 10c-3-3-4-6-4-10s1-7 4-10Z",
    };
    const svg = this.doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "concept-icon");
    svg.setAttribute("aria-hidden", "true");
    const path = this.doc.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", paths[name] || paths.grid);
    svg.append(path);
    return svg;
  }
  iconButton(name, label, action, className = "") {
    const button = this.button("", label, action, className);
    button.append(this.icon(name));
    return button;
  }
  spaceIcon(space, index = 0) {
    if (space?.icon && !space.icon.endsWith(".svg")) {
      return this.node("span", "concept-space-emoji", space.icon);
    }
    return this.icon(["home", "briefcase", "leaf", "grid"][index % 4]);
  }
  agentColor(agent = {}) {
    const found = this.space.agents.findIndex((item) => item.id === agent.id);
    const index = found < 0 ? this.space.agents.length : found;
    return /^#[0-9a-f]{6}$/i.test(agent.color || "")
      ? agent.color
      : ["#9ac0ff", "#c7a4ef", "#91d1be", "#e6b493"][index % 4];
  }
  agentBody(agent = {}) {
    const light = this.node(
      "span",
      agent.persistent ? "concept-hyper-body" : "concept-task-light",
    );
    light.setAttribute("aria-hidden", "true");
    light.style.setProperty("--agent-light", this.agentColor(agent));
    return light;
  }
  get spaceId() {
    return this.win.gZenWorkspaces.activeWorkspace || "home";
  }
  get space() {
    return (this.data.spaces[this.spaceId] ||= {
      items: [],
      agents: [],
      memory: [],
    });
  }
  get items() {
    let list = this.space.items;
    for (const id of this.path) {
      const folder = list.find((x) => x.id === id && x.type === "folder");
      if (!folder) {
        this.path = [];
        return this.space.items;
      }
      list = folder.items;
    }
    return list;
  }
  async init() {
    if (!Services.prefs.getBoolPref("browser.concept.enabled", false)) return;
    this.private = this.win.PrivateBrowsingUtils.isWindowPrivate(this.win);
    if (!this.private) {
      try {
        this.data = await ConceptStore.load();
      } catch (error) {
        this.storeError = true;
        console.error("Concept store could not be loaded:", error);
      }
    }
    this.doc.documentElement.setAttribute("browser-concept", "true");
    const link = this.node("link");
    link.rel = "stylesheet";
    link.href = "chrome://browser/content/zen-styles/browser-concept.css";
    this.doc.documentElement.append(link);
    this.root = this.node("div", "concept-root");
    this.root.id = "concept-root";
    this.notch = this.node("div", "concept-notch");
    this.trigger = this.button(
      "",
      "Open notch",
      () => this.toggle(),
      "concept-notch-trigger",
    );
    this.trigger.append(this.node("span", "concept-notch-handle"));
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.setAttribute("aria-controls", "concept-shelf");
    this.shelf = this.node("section", "concept-shelf");
    this.shelf.id = "concept-shelf";
    this.shelf.hidden = true;
    this.shelf.setAttribute("aria-label", "Spaces and pinned items");
    this.siteBadge = this.button(
      "",
      "Open notch",
      () => this.toggle(true),
      "concept-site-badge",
    );
    this.address = this.button(
      "",
      "Search or edit address",
      () => {
        this.win.gURLBar.focus();
        this.win.gURLBar.select();
      },
      "concept-address",
    );
    this.notch.append(this.trigger, this.shelf);
    this.root.append(this.notch, this.siteBadge, this.address);
    this.doc.documentElement.append(this.root);
    this.panel = this.node("div", "concept-cursor-popover");
    this.panel.hidden = true;
    this.panel.hidePopup = () => {
      this.panel.hidden = true;
    };
    this.panel.id = "concept-cursor-panel";
    this.panel.setAttribute("noautofocus", "true");
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-label", "Agent prompt");
    this.doc.documentElement.append(this.panel);
    this.panelBody = this.node("div", "concept-cursor-body");
    this.panel.append(this.panelBody);

    this.addDock();
    this.addAgentPanel();
    this.win.gBrowser.tabContainer.addEventListener("TabSelect", this.onEvent);
    this.win.gBrowser.tabContainer.addEventListener(
      "TabAttrModified",
      this.onEvent,
    );
    this.win.gBrowser.tabContainer.addEventListener("TabClose", this.onEvent);
    this.win.gBrowser.tabContainer.addEventListener("TabOpen", this.onEvent);
    this.win.gBrowser.tabContainer.addEventListener("TabMove", this.onEvent);
    this.win.gBrowser.tabContainer.addEventListener(
      "SSTabRestored",
      this.onEvent,
    );
    this.win.addEventListener("ZenWorkspacesUIUpdate", this.onEvent);
    this.win.addEventListener("SSWindowRestored", this.onEvent);
    this.trailSpaceObserver = new MutationObserver(() =>
      this.scheduleTrailRender(),
    );
    this.trailSpaceObserver.observe(this.win.gBrowser.tabContainer, {
      attributes: true,
      subtree: true,
      attributeFilter: ["zen-workspace-id"],
    });
    this.doc.addEventListener("keydown", this.onEvent, true);
    this.doc.addEventListener("pointerdown", this.onEvent, true);
    this.win.addEventListener("unload", () => this.destroy(), { once: true });
    this.shelf.addEventListener("dragover", (event) => {
      if (
        [...event.dataTransfer.types].some((x) =>
          ["text/x-moz-url", "application/x-moz-tabbrowser-tab"].includes(x),
        )
      ) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    });
    this.shelf.addEventListener("drop", (event) => {
      event.preventDefault();
      let tab;
      try {
        tab = event.dataTransfer.mozGetDataAt(
          "application/x-moz-tabbrowser-tab",
          0,
        );
      } catch {}
      const raw = event.dataTransfer.getData("text/x-moz-url").split("\n");
      this.pinURL(
        tab?.linkedBrowser?.currentURI?.spec || raw[0],
        tab?.label || raw[1],
      );
    });
    this.storeListener = () => this.render();
    if (!this.private) ConceptStore.listeners.add(this.storeListener);
    this.render();
    this.scheduleTrailRender();
    this.showSiteTitle();
    if (this.storeError)
      this.notice("Saved items could not be read. Your file has been kept.");
    console.info("Browser concept initialized");
  }
  async save() {
    if (this.private) return true;
    if (this.storeError) {
      this.notice("Storage is unavailable. Changes will not be saved.");
      return false;
    }
    try {
      await ConceptStore.save();
      return true;
    } catch (error) {
      console.error(error);
      this.notice("Could not save changes.");
      return false;
    }
  }
  handleEvent(event) {
    if (event.type === "TabClose") {
      for (const operation of this.runningTools.values()) {
        if (operation.tab === event.target) operation.controller.abort();
      }
      this.ownership.close(event.target);
      if (!event.detail?.adoptedBy) this.closeTrailParent(event.target);
      else this.scheduleTrailRender();
      return;
    }
    if (
      event.type === "TabOpen" ||
      event.type === "TabMove" ||
      event.type === "SSTabRestored" ||
      event.type === "SSWindowRestored"
    ) {
      this.scheduleTrailRender(event.type === "SSWindowRestored");
      return;
    }
    if (
      event.type === "TabSelect" ||
      event.type === "TabAttrModified" ||
      event.type === "ZenWorkspacesUIUpdate"
    ) {
      if (event.type === "TabAttrModified") {
        for (const operation of this.runningTools.values()) {
          if (
            operation.tab === event.target &&
            safeWebURL(operation.tab.linkedBrowser.currentURI.spec) !==
              operation.url
          )
            operation.controller.abort();
        }
        this.updateAddress();
        return;
      }
      for (const operation of this.runningTools.values()) {
        if (
          operation.tab !== this.win.gBrowser.selectedTab ||
          operation.spaceId !== this.spaceId
        )
          operation.controller.abort();
      }
      this.panel.hidePopup();
      if (event.type === "ZenWorkspacesUIUpdate") this.path = [];
      this.render();
      if (event.type === "TabSelect") this.scheduleTrailRender();
      if (event.type === "ZenWorkspacesUIUpdate") this.scheduleTrailRender();
      if (event.type === "TabSelect") this.showSiteTitle();
      return;
    }
    if (event.type === "keydown" && event.key === "Escape") {
      this.toggle(false);
      this.panel.hidePopup();
      this.closeAgentPanel();
      return;
    }
    if (event.type === "pointerdown" && !this.root.contains(event.target)) {
      this.toggle(false);
      if (!this.panel.contains(event.target)) this.panel.hidePopup();
    }
  }
  addDock() {
    const host =
      this.doc.getElementById("TabsToolbar-customization-target") ||
      this.doc.getElementById("TabsToolbar");
    this.dock = this.node("div", "concept-agent-dock");
    this.dock.id = "concept-agent-dock";
    this.dock.setAttribute("skipintoolbarset", "true");
    this.dock.append(
      this.iconButton("plus", "New agent", (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        this.showCursorPrompt(
          {
            kind: "shake",
            x: rect.right + this.win.mozInnerScreenX,
            y: rect.top + this.win.mozInnerScreenY,
            selection: "",
            title: this.win.gBrowser.selectedTab.label,
          },
          this.win.gBrowser.selectedBrowser,
        );
        this.panel.querySelector("input")?.focus();
      }),
    );
    this.dock.setAttribute("role", "group");
    this.dock.setAttribute("aria-label", "Agents in this space");
    const footer = this.doc.getElementById("zen-sidebar-foot-buttons");
    if (footer) footer.prepend(this.dock);
    else host?.append(this.dock);
  }
  addAgentPanel() {
    this.agentPanel = this.node("aside", "concept-agent-panel");
    this.agentPanel.hidden = true;
    this.agentPanel.setAttribute("aria-label", "Agent context");
    this.doc.documentElement.append(this.agentPanel);
    this.onAgentResize = () => this.clampAgentPanel();
    this.win.addEventListener("resize", this.onAgentResize);
  }
  closeAgentPanel() {
    this.agentPanel.hidden = true;
    this.doc.documentElement.removeAttribute("concept-agent-open");
    this.doc.documentElement.removeAttribute("concept-agent-docked");
    if (this.agentReturnFocus?.isConnected) this.agentReturnFocus.focus();
    else this.win.gBrowser.selectedBrowser?.focus();
  }
  toggleAgentDock() {
    this.agentDocked = !this.agentDocked;
    this.agentPanel.toggleAttribute("concept-docked", this.agentDocked);
    this.doc.documentElement.toggleAttribute(
      "concept-agent-docked",
      this.agentDocked && !this.agentPanel.hidden,
    );
    const label = this.agentDocked ? "Undock agent" : "Dock agent";
    this.agentDockButton.title = label;
    this.agentDockButton.setAttribute("aria-label", label);
    if (!this.agentDocked) this.clampAgentPanel();
  }
  clampAgentPanel() {
    if (!this.agentPosition || this.agentDocked || this.agentPanel.hidden)
      return;
    const rect = this.agentPanel.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(this.agentPosition.left, this.win.innerWidth - rect.width - 8),
    );
    const top = Math.max(
      44,
      Math.min(this.agentPosition.top, this.win.innerHeight - rect.height - 8),
    );
    this.agentPosition = { left, top };
    this.agentPanel.style.left = left + "px";
    this.agentPanel.style.top = top + "px";
    this.agentPanel.style.right = "auto";
  }
  dragAgentPanel(header) {
    header.addEventListener("pointerdown", (event) => {
      if (
        this.agentDocked ||
        event.button !== 0 ||
        event.target.closest("button")
      )
        return;
      const rect = this.agentPanel.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      header.setPointerCapture(event.pointerId);
      this.agentPanel.setAttribute("concept-dragging", "true");
      const move = (moveEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        this.agentPosition = {
          left: moveEvent.clientX - offsetX,
          top: moveEvent.clientY - offsetY,
        };
        this.clampAgentPanel();
      };
      const finish = () => {
        header.removeEventListener("pointermove", move);
        header.removeEventListener("pointerup", finish);
        header.removeEventListener("pointercancel", finish);
        this.agentPanel.removeAttribute("concept-dragging");
      };
      header.addEventListener("pointermove", move);
      header.addEventListener("pointerup", finish);
      header.addEventListener("pointercancel", finish);
    });
  }
  async performBrowserTool(tool, tab) {
    if (tool !== "browser.page.snapshot")
      throw new Error("Unknown browser tool");
    const actor =
      tab.linkedBrowser.browsingContext.currentWindowGlobal.getActor(
        "ConceptCursor",
      );
    const result = await actor.sendQuery("ConceptCursor:Snapshot");
    if (
      !result ||
      !safeWebURL(result.url) ||
      safeWebURL(result.url) !== safeWebURL(tab.linkedBrowser.currentURI.spec)
    )
      throw new Error("Page could not be read");
    return result;
  }
  async inspectAgentPage(agent, context, controls) {
    if (this.runningTools.has(agent.id)) return;
    const sourceURL = safeWebURL(context.url);
    const tab = this.win.gBrowser.selectedTab;
    const isCurrent = () =>
      this.spaceId === context.spaceId &&
      this.win.gBrowser.selectedTab === tab &&
      safeWebURL(tab?.linkedBrowser?.currentURI?.spec) === sourceURL;
    if (!sourceURL || !isCurrent()) {
      controls.message.textContent = "Open this task’s page to inspect it.";
      return;
    }
    const controller = new AbortController();
    const runId = this.taskState.createRun({
      taskId: agent.id,
      spaceId: context.spaceId,
    }).runId;
    this.taskState.transition(runId, "queued");
    this.taskState.transition(runId, "running");
    this.taskState.transition(runId, "awaiting-permission");
    this.runningTools.set(agent.id, {
      controller,
      runId,
      tab,
      spaceId: context.spaceId,
      url: sourceURL,
    });
    controls.button.disabled = true;
    controls.stop.hidden = false;
    controls.status.textContent = "Waiting";
    const event = this.node("div", "concept-tool-event");
    event.append(
      this.node("span", "concept-tool-event-dot"),
      this.node("strong", "", "Read this page"),
      this.node("span", "concept-tool-event-state", "Waiting for permission"),
    );
    controls.trace.append(event);
    let activated = false;
    let outcome = "Could not read page";
    try {
      const run = new AgentRun({
        invokeTool: (tool, signal) =>
          this.toolGate.invoke({
            agentId: agent.id,
            spaceId: context.spaceId,
            tab,
            active: true,
            tool,
            isCurrent,
            signal,
            authorize: () =>
              Services.prompt.confirm(
                this.win,
                "Use this tab?",
                `Allow “${agent.name}” to read the text of “${tab.label}”?`,
              ),
            onAuthorized: () => {
              this.taskState.transition(runId, "running", {
                summary: "Tab access allowed",
              });
              this.setAgentActivity(tab, agent, {
                working: true,
                color: this.agentColor(agent),
              });
              activated = true;
              this.dock.setAttribute("concept-agent-active", "true");
              controls.status.textContent = "Reading page";
              event.querySelector(".concept-tool-event-state").textContent =
                "Reading page";
            },
          }),
        onEvent: (entry) => {
          if (entry.type === "tool-requested")
            this.taskState.appendEvent(runId, {
              kind: "tool-requested",
              summary: "Read this page requested",
            });
          if (entry.type === "tool-finished")
            this.taskState.appendEvent(runId, {
              kind: "tool-finished",
              summary:
                entry.status === "denied"
                  ? "Tab access declined"
                  : `Page read: ${entry.characters} characters`,
            });
          if (entry.type === "tool-finished")
            event.querySelector(".concept-tool-event-state").textContent =
              entry.status === "denied"
                ? "Permission declined"
                : `${entry.characters.toLocaleString()} chars`;
        },
      });
      const { lastToolResult: response } = await run.run(
        localPageInspection(),
        { signal: controller.signal },
      );
      if (response.status === "denied") {
        this.taskState.transition(runId, "failed", {
          summary: "Tab access declined",
        });
        outcome = "Permission declined";
        controls.status.textContent = "Saved";
        controls.message.textContent = "Tab access was declined.";
      } else {
        this.taskState.transition(runId, "completed", {
          summary: "Page read completed",
        });
        const page = response.result;
        outcome = `${page.text.length.toLocaleString()} chars`;
        controls.status.textContent = "Page ready";
        const details = this.node("details", "concept-tool-output");
        details.append(
          this.node("summary", "", page.title || "Page text"),
          this.node("pre", "", page.text.slice(0, 1200)),
        );
        controls.trace.append(details);
        controls.message.textContent =
          "Page inspected locally. The agent model is not connected yet.";
      }
    } catch (error) {
      const run = this.taskState.getRun(runId);
      if (
        error.message === "Tool cancelled" ||
        error.message === "Run cancelled"
      ) {
        if (["queued", "running", "awaiting-permission"].includes(run.status)) {
          this.taskState.transition(runId, "stopping");
          this.taskState.transition(runId, "cancelled");
        }
      } else if (
        ["queued", "running", "awaiting-permission"].includes(run.status)
      ) {
        this.taskState.transition(runId, "failed", {
          summary: "Page read failed",
        });
      }
      if (!["Tool cancelled", "Run cancelled"].includes(error.message))
        console.error("Agent page inspection failed:", error);
      controls.status.textContent = "Saved";
      event.querySelector(".concept-tool-event-state").textContent = [
        "Tool cancelled",
        "Run cancelled",
      ].includes(error.message)
        ? "Stopped"
        : "Could not read page";
      controls.message.textContent = [
        "Tool cancelled",
        "Run cancelled",
      ].includes(error.message)
        ? "Page read stopped."
        : "Could not inspect this page.";
      outcome = ["Tool cancelled", "Run cancelled"].includes(error.message)
        ? "Stopped"
        : outcome;
    } finally {
      if (activated) this.setAgentActivity(tab, agent, { working: false });
      this.runningTools.delete(agent.id);
      if (!this.runningTools.size)
        this.dock.removeAttribute("concept-agent-active");
      controls.button.disabled = false;
      controls.stop.hidden = true;
      const history = this.toolHistory.get(agent.id) || [];
      history.push(outcome);
      this.toolHistory.set(agent.id, history.slice(-10));
    }
  }
  notice(text) {
    this.address.textContent = text;
    this.win.setTimeout(() => this.updateAddress(), 3000);
  }
  showSiteTitle() {
    this.root.classList.add("concept-title-visible");
    this.win.clearTimeout(this.siteTitleTimer);
    this.siteTitleTimer = this.win.setTimeout(
      () => this.root.classList.remove("concept-title-visible"),
      2400,
    );
  }
  updateAddress() {
    const tab = this.win.gBrowser.selectedTab;
    const url = this.win.gBrowser.selectedBrowser.currentURI.spec;
    const title = (tab?.label || "New Tab").slice(0, 80);
    this.siteBadge.replaceChildren();
    if (safeWebURL(url)) {
      const favicon = this.node("img");
      favicon.src =
        tab?.image || tab?.getAttribute("image") || "page-icon:" + url;
      favicon.alt = "";
      favicon.addEventListener(
        "error",
        () => favicon.replaceWith(this.icon("globe")),
        { once: true },
      );
      this.siteBadge.append(favicon);
    } else this.siteBadge.append(this.icon("globe"));
    this.siteBadge.setAttribute("aria-label", "Open notch for " + title);
    this.address.replaceChildren(
      this.node("span", "concept-address-label", title),
    );
    this.address.title = url;
    this.address.setAttribute("aria-label", "Search or edit address: " + title);
  }
  toggle(open = !this.shelf.hidden) {
    // No argument toggles; an explicit boolean sets the open state.
    if (arguments.length === 0) open = this.shelf.hidden;
    this.shelf.hidden = !open;
    this.root.classList.toggle("open", open);
    this.trigger.setAttribute("aria-expanded", String(open));
    this.trigger.title = open ? "Close notch" : "Open notch";
    if (open) {
      this.renderShelf();
      this.shelf.querySelector("input")?.focus({ preventScroll: true });
    }
  }
  render() {
    this.updateAddress();
    if (!this.shelf.hidden) this.renderShelf();
    this.renderAgents();
  }
  trailValue(tab, key) {
    try {
      if (this.private)
        return key === "concept.trail.id"
          ? tab._conceptTrailId
          : tab._conceptTrailParent;
      return SessionStore.getCustomTabValue(tab, key);
    } catch {
      return "";
    }
  }
  clearTrailParent(tab) {
    tab.removeAttribute("concept-trail-parent");
    if (this.private) delete tab._conceptTrailParent;
    else {
      try {
        SessionStore.deleteCustomTabValue(tab, "concept.trail.parent");
      } catch (error) {
        console.error("Could not clear Trail parent:", error);
      }
    }
  }
  closeTrailParent(closedTab) {
    const id = this.trailValue(closedTab, "concept.trail.id");
    if (!id) return;
    for (const tab of this.win.gBrowser.tabs) {
      if (tab === closedTab) continue;
      if (this.trailValue(tab, "concept.trail.parent") === id)
        this.clearTrailParent(tab);
    }
    this.scheduleTrailRender();
  }
  scheduleTrailRender(reconcile = false) {
    this.reconcileTrails ||= reconcile;
    if (this.trailRenderTimer) return;
    this.trailRenderTimer = this.win.setTimeout(() => {
      this.trailRenderTimer = null;
      const shouldReconcile = this.reconcileTrails;
      this.reconcileTrails = false;
      this.renderTrails({ reconcile: shouldReconcile });
    }, 0);
  }
  renderTrails({ reconcile = false } = {}) {
    const tabs = [...this.win.gBrowser.tabs].filter(
      (tab) =>
        !tab.hasAttribute("zen-glance-tab") &&
        !tab.hasAttribute("zen-empty-tab"),
    );
    const byId = new Map();
    const nodes = new Map();
    for (const tab of tabs) {
      let id = this.trailValue(tab, "concept.trail.id");
      if (id && byId.has(id)) {
        id = Services.uuid.generateUUID().toString().slice(1, -1);
        try {
          if (this.private) tab._conceptTrailId = id;
          else SessionStore.setCustomTabValue(tab, "concept.trail.id", id);
        } catch (error) {
          console.error("Could not repair duplicate Trail ID:", error);
          id = "";
        }
        this.clearTrailParent(tab);
      }
      const node = {
        id,
        parentId: this.trailValue(tab, "concept.trail.parent"),
        spaceId: tab.getAttribute("zen-workspace-id"),
      };
      nodes.set(tab, node);
      if (id) byId.set(id, node);
    }
    for (const tab of tabs) {
      const { depth: level, issue } = trailDepth(nodes.get(tab), byId);
      if (issue === "space" || (issue && reconcile)) this.clearTrailParent(tab);
      if (level) {
        if (tab.getAttribute("concept-trail-depth") !== String(level))
          tab.setAttribute("concept-trail-depth", String(level));
        const parentId = this.trailValue(tab, "concept.trail.parent");
        if (tab.getAttribute("concept-trail-parent") !== parentId)
          tab.setAttribute("concept-trail-parent", parentId);
        tab.style.setProperty(
          "--concept-trail-indent",
          `${Math.min(3, level) * 17}px`,
        );
      } else {
        tab.removeAttribute("concept-trail-depth");
        tab.style.removeProperty("--concept-trail-indent");
      }
    }
  }
  renderShelf() {
    this.shelf.replaceChildren();
    const cardCount = this.items.length;
    this.notch.style.setProperty(
      "--concept-shelf-width",
      (this.path.length
        ? Math.min(700, Math.max(360, 18 + cardCount * 134))
        : 700) + "px",
    );
    const top = this.node("div", "concept-shelf-top");
    const search = this.node("input", "concept-pin-search");
    search.placeholder = "Find a pin…";
    search.setAttribute("aria-label", "Find pinned items");
    top.append(
      this.icon("search"),
      search,
      this.iconButton("star", "Pin current tab", () =>
        this.pinURL(
          this.win.gBrowser.selectedBrowser.currentURI.spec,
          this.win.gBrowser.selectedTab.label,
        ),
      ),
      this.iconButton("folder", "New folder", () => this.createFolder()),
      this.iconButton("close", "Close notch", () => {
        this.toggle(false);
        this.trigger.focus();
      }),
    );
    this.shelf.append(top);
    const nav = this.node("nav", "concept-space-icons");
    if (this.path.length) {
      nav.classList.add("concept-breadcrumbs");
      const active = this.win.gZenWorkspaces
        .getWorkspaces()
        .find((x) => x.uuid === this.spaceId);
      const home = this.button("", "Space home", () => {
        this.path = [];
        this.renderShelf();
      });
      home.append(
        this.spaceIcon(active),
        this.node(
          "span",
          "",
          active?.name === "Space" ? "Home" : active?.name || "Home",
        ),
      );
      nav.append(home);
      let list = this.space.items;
      this.path.forEach((id, i) => {
        const folder = list.find((x) => x.id === id);
        if (!folder) return;
        nav.append(
          this.icon("chevron"),
          this.button(folder.name, folder.name, () => {
            this.path = this.path.slice(0, i + 1);
            this.renderShelf();
          }),
        );
        list = folder.items;
      });
    } else {
      for (const [index, space] of this.win.gZenWorkspaces
        .getWorkspaces()
        .entries()) {
        const b = this.button(
          "",
          space.name,
          async () => {
            this.path = [];
            await this.win.gZenWorkspaces.changeWorkspaceWithID(space.uuid);
            this.render();
          },
          "concept-space-icon",
        );
        b.append(this.spaceIcon(space, index));
        b.setAttribute("aria-pressed", String(space.uuid === this.spaceId));
        nav.append(b);
      }
      nav.append(
        this.iconButton("plus", "Manage spaces", () => {
          this.toggle(false);
          this.win.gZenWorkspaces.openWorkspaceCreation();
        }),
      );
    }
    this.shelf.append(nav);
    const cards = this.node("div", "concept-pin-cards");
    for (const item of this.items) {
      const card = this.button(
        "",
        item.name,
        () => {
          if (item.type === "folder") {
            this.path.push(item.id);
            this.renderShelf();
          } else {
            const url = safeWebURL(item.url);
            if (url) {
              this.win.openTrustedLinkIn(url, "tab");
              this.toggle(false);
            }
          }
        },
        "concept-pin-card",
      );
      const icon = this.node(
        "span",
        item.type === "folder" ? "concept-folder-icon" : "concept-site-icon",
        "",
      );
      if (item.type === "folder") {
        card.classList.add("concept-folder-card");
        const previews = item.items.slice(0, 4);
        for (const preview of previews) {
          if (preview.type === "site" && safeWebURL(preview.url)) {
            const img = this.node("img");
            img.src = "page-icon:" + preview.url;
            img.alt = "";
            icon.append(img);
          } else icon.append(this.icon("folder"));
        }
        if (!previews.length) icon.append(this.icon("folder"));
      }
      if (item.type !== "folder" && safeWebURL(item.url)) {
        const img = this.node("img");
        img.src = "page-icon:" + item.url;
        img.alt = "";
        icon.append(img);
      }
      card.append(icon, this.node("span", "concept-pin-label", item.name));
      card.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (
          Services.prompt.confirm(
            this.win,
            "Remove pinned item",
            "Remove “" + item.name + "” from the notch?",
          )
        ) {
          const list = this.items;
          list.splice(list.indexOf(item), 1);
          this.save();
          this.renderShelf();
        }
      });
      cards.append(card);
    }
    this.shelf.classList.toggle("empty", !cards.children.length);
    if (!cards.children.length)
      cards.append(
        this.node(
          "span",
          "concept-empty",
          this.path.length ? "Empty folder" : "No pins yet",
        ),
      );
    search.addEventListener("input", () => {
      for (const card of cards.querySelectorAll("button"))
        card.hidden = !card.textContent
          .toLowerCase()
          .includes(search.value.toLowerCase());
    });
    this.shelf.append(cards);
  }
  createFolder() {
    const name = { value: "" };
    if (
      Services.prompt.prompt(this.win, "New folder", "Name", name, null, {}) &&
      name.value.trim()
    ) {
      this.items.push({
        id: Services.uuid.generateUUID().toString(),
        type: "folder",
        name: name.value.trim().slice(0, 80),
        items: [],
      });
      this.save();
      this.renderShelf();
    }
  }
  pinURL(raw, name) {
    const url = safeWebURL(raw);
    if (!url) {
      this.notice("Only web pages can be pinned here.");
      return;
    }
    if (!this.items.some((x) => x.url === url)) {
      this.items.push({
        id: Services.uuid.generateUUID().toString(),
        type: "site",
        url,
        name: String(name || new URL(url).hostname).slice(0, 100),
      });
      this.save();
    }
    this.toggle(true);
  }
  hideCursorSelection() {
    if (this.cursorContext?.kind === "selection") this.panel.hidePopup();
  }
  showCursorPrompt(data, browser) {
    this.panel.hidePopup();
    this.cursorContext = {
      ...data,
      browser,
      url: browser.currentURI.spec,
      spaceId: this.spaceId,
    };
    this.panelBody.replaceChildren();
    if (data.kind === "selection") {
      this.panelBody.className = "concept-cursor-body selection";
      for (const action of ["Explain", "Summarize", "Ask"])
        this.panelBody.append(
          this.button(action, action + " selection", () => {
            const context = this.cursorContext;
            if (!context) return;
            this.panel.hidePopup();
            this.showAgentPanel(action, context);
          }),
        );
    } else {
      this.panelBody.className = "concept-cursor-body";
      const form = this.node("form", "concept-quick-prompt");
      const glow = this.agentBody();
      const input = this.node("input");
      input.placeholder = "Ask about this page…";
      input.setAttribute("aria-label", "Agent prompt");
      const send = this.iconButton(
        "arrow",
        "Open agent conversation",
        () => {},
      );
      send.type = "submit";
      form.append(glow, input, send);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const context = this.cursorContext;
        if (!context) return;
        this.panel.hidePopup();
        this.showAgentPanel(input.value, context);
      });
      this.panelBody.append(form);
    }
    this.panel.hidden = false;
    const { width, height } = this.panel.getBoundingClientRect();
    const x = data.x - this.win.mozInnerScreenX;
    const y = data.y - this.win.mozInnerScreenY;
    // Selection actor sends the top-right of the highlighted range. Keep the
    // menu above that corner, falling below only when there is no room above.
    const left = data.kind === "selection" ? x - width : x - 24;
    const top = y >= height + 16 ? y - height - 8 : y + 20;
    this.panel.style.left =
      Math.max(8, Math.min(left, this.win.innerWidth - width - 8)) + "px";
    this.panel.style.top =
      Math.max(8, Math.min(top, this.win.innerHeight - height - 8)) + "px";
  }

  showAgentPanel(prompt, context = {}, existingAgent = null) {
    if (!this.agentPanel.contains(this.doc.activeElement))
      this.agentReturnFocus = this.doc.activeElement;
    context = {
      url: this.win.gBrowser.selectedBrowser.currentURI.spec,
      spaceId: this.spaceId,
      ...context,
    };
    this.agentPanel.replaceChildren();
    this.agentPanel.hidden = false;
    this.doc.documentElement.setAttribute("concept-agent-open", "true");
    this.agentPanel.toggleAttribute("concept-docked", !!this.agentDocked);
    this.doc.documentElement.toggleAttribute(
      "concept-agent-docked",
      !!this.agentDocked,
    );
    this.clampAgentPanel();
    const header = this.node("div", "concept-agent-header");
    const status = this.node(
      "span",
      "concept-agent-status",
      existingAgent ? "Saved" : "Draft",
    );
    const heading = this.node("strong", "", existingAgent?.name || "New agent");
    header.append(
      this.agentBody(existingAgent || {}),
      heading,
      status,
      (this.agentDockButton = this.iconButton("dock", "Dock agent", () =>
        this.toggleAgentDock(),
      )),
      this.iconButton("close", "Close agent", () => {
        this.closeAgentPanel();
      }),
    );
    if (this.agentDocked) {
      this.agentDockButton.title = "Undock agent";
      this.agentDockButton.setAttribute("aria-label", "Undock agent");
    }
    this.dragAgentPanel(header);
    const sourceTitle = context.title || this.win.gBrowser.selectedTab.label;
    const source = this.node("div", "concept-agent-source");
    if (safeWebURL(context.url)) {
      const favicon = this.node("img");
      favicon.src = "page-icon:" + context.url;
      favicon.alt = "";
      source.append(favicon);
    }
    const sourceText = this.node("span", "", sourceTitle);
    source.append(sourceText);
    source.title = context.url;
    this.agentPanel.append(header, source);
    if (context.selection) {
      const selection = this.node("details", "concept-agent-selection");
      const preview = context.selection.trim().replace(/\s+/g, " ");
      selection.append(
        this.node(
          "summary",
          "",
          "Selected text · " +
            preview.slice(0, 92) +
            (preview.length > 92 ? "…" : ""),
        ),
        this.node("blockquote", "", context.selection),
      );
      this.agentPanel.append(selection);
    }
    const input = this.node("textarea", "concept-agent-input");
    input.value = prompt;
    input.placeholder = "What would you like to do?";
    input.setAttribute("aria-label", "Agent task");
    const persistent = this.node("label", "concept-persistent");
    const checkbox = this.node("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!existingAgent?.persistent;
    persistent.append(checkbox, this.node("span", "", "Keep this agent"));
    const message = this.node(
      "p",
      "concept-agent-connection",
      "Browser tools work locally. The agent model is not connected yet.",
    );
    const toolArea = this.node("section", "concept-tool-area");
    toolArea.setAttribute("aria-label", "Agent activity");
    const toolHeader = this.node("div", "concept-tool-heading");
    toolHeader.append(this.node("span", "", "Activity"));
    const inspect = this.button(
      "Inspect page",
      "Read this page with the browser tool",
      () =>
        this.inspectAgentPage(existingAgent, context, {
          button: inspect,
          stop,
          message,
          status,
          trace,
        }),
    );
    inspect.disabled = !existingAgent;
    const stop = this.button("Stop", "Stop page read", () => {
      this.runningTools.get(existingAgent?.id)?.controller.abort();
    });
    stop.hidden = !this.runningTools.has(existingAgent?.id);
    if (!stop.hidden) inspect.disabled = true;
    toolHeader.append(inspect, stop);
    const trace = this.node("div", "concept-tool-trace");
    trace.setAttribute("role", "log");
    trace.setAttribute("aria-live", "polite");
    for (const outcome of this.toolHistory.get(existingAgent?.id) || []) {
      const prior = this.node("div", "concept-tool-event");
      prior.append(
        this.node("span", "concept-tool-event-dot"),
        this.node("strong", "", "Read this page"),
        this.node("span", "concept-tool-event-state", outcome),
      );
      trace.append(prior);
    }
    toolArea.append(toolHeader, trace);
    const save = this.button(
      "Save task",
      "Save agent task",
      async () => {
        if (!input.value.trim()) return;
        if (context.spaceId !== this.spaceId) {
          message.textContent =
            "Return to the original space to save this task.";
          return;
        }
        save.disabled = true;
        const draft = {
          id: existingAgent?.id || Services.uuid.generateUUID().toString(),
          name: input.value.trim().slice(0, 45),
          prompt: input.value.trim(),
          persistent: checkbox.checked,
          color: this.agentColor(existingAgent || {}),
          status: "pending",
          context: {
            title: sourceTitle,
            selection: context.selection || "",
            url: context.url,
          },
        };
        if (existingAgent) Object.assign(existingAgent, draft);
        else {
          this.space.agents.push(draft);
          existingAgent = draft;
        }
        const saved = await this.save();
        this.renderAgents();
        heading.textContent = draft.name;
        status.textContent = "Saved";
        inspect.disabled = !saved;
        message.textContent = saved
          ? this.private
            ? "Task kept for this private window. It has not started."
            : "Task saved in this space. It has not started."
          : "Could not save to disk. The draft is still here.";
        save.disabled = saved;
      },
      "concept-primary",
    );
    input.addEventListener("input", () => {
      save.disabled = false;
    });
    checkbox.addEventListener("change", () => {
      save.disabled = false;
    });
    const actions = this.node("div", "concept-agent-actions");
    actions.append(persistent, save);
    message.setAttribute("role", "status");
    this.agentPanel.append(
      toolArea,
      this.node("label", "concept-input-label", "Task"),
      input,
      actions,
      message,
    );
    input.focus();
  }
  renderAgents() {
    for (const old of this.dock?.querySelectorAll(".concept-saved-agent") || [])
      old.remove();
    for (const agent of this.space.agents) {
      const b = this.button(
        "",
        agent.name + " · saved, not started",
        () => this.showAgentPanel(agent.prompt, agent.context, agent),
        "concept-saved-agent",
      );
      b.append(this.agentBody(agent));
      const tooltip = this.node("span", "concept-agent-tooltip");
      tooltip.append(
        this.node("strong", "", agent.name),
        this.node("span", "", "Saved · not started"),
      );
      b.append(tooltip);
      this.dock.insertBefore(b, this.dock.lastChild);
    }
  }
  setAgentActivity(tab, agent, { working = false, color = "#639bff" } = {}) {
    if (!working) {
      tab.removeAttribute("concept-agent-working");
      tab.style.removeProperty("--concept-agent-color");
      return;
    }
    this.ownership.assertAllowed(tab, agent.id, this.spaceId);
    tab.setAttribute("concept-agent-working", "true");
    tab.style.setProperty(
      "--concept-agent-color",
      /^#[0-9a-f]{6}$/i.test(color) ? color : "#639bff",
    );
  }
  destroy() {
    this.win.clearTimeout(this.siteTitleTimer);
    this.win.clearTimeout(this.trailRenderTimer);
    this.trailSpaceObserver?.disconnect();
    ConceptStore.listeners.delete(this.storeListener);
    this.win.gBrowser.tabContainer.removeEventListener(
      "TabSelect",
      this.onEvent,
    );
    this.win.gBrowser.tabContainer.removeEventListener(
      "TabAttrModified",
      this.onEvent,
    );
    this.win.gBrowser.tabContainer.removeEventListener(
      "TabClose",
      this.onEvent,
    );
    this.win.gBrowser.tabContainer.removeEventListener("TabOpen", this.onEvent);
    this.win.gBrowser.tabContainer.removeEventListener("TabMove", this.onEvent);
    this.win.gBrowser.tabContainer.removeEventListener(
      "SSTabRestored",
      this.onEvent,
    );
    this.win.removeEventListener("ZenWorkspacesUIUpdate", this.onEvent);
    this.win.removeEventListener("SSWindowRestored", this.onEvent);
    this.win.removeEventListener("resize", this.onAgentResize);
    this.doc.removeEventListener("keydown", this.onEvent, true);
    this.doc.removeEventListener("pointerdown", this.onEvent, true);
  }
}

window.gZenStartup.promiseInitialized.then(async () => {
  try {
    window.gBrowserConcept = new BrowserConcept(window);
    await window.gBrowserConcept.init();
  } catch (error) {
    console.error("Browser concept startup failed:", error);
  }
});
