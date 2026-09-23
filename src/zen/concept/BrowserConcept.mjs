// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
import {
  safeWebURL,
  AgentOwnership,
} from "resource:///modules/zen/concept/ConceptModel.sys.mjs";

import { ConceptStore } from "resource:///modules/zen/concept/ConceptStore.sys.mjs";

const HTML = "http://www.w3.org/1999/xhtml";
class BrowserConcept {
  constructor(win) {
    this.win = win;
    this.doc = win.document;
    this.path = [];
    this.onEvent = this.handleEvent.bind(this);
    this.ownership = new AgentOwnership();
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
      folder:
        "M3 7V5a1 1 0 0 1 1-1h6l3 3h7a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z",
      star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9L7.5 14 3 9.6l6.2-.9Z",
      chevron: "m9 5 7 7-7 7",
      arrow: "M12 20V4m-6 6 6-6 6 6",
      briefcase: "M8 7V4h8v3M3 7h18v13H3ZM3 12h18M10 12v3h4v-3",
      leaf: "M5 19C0 8 11 3 21 3c0 10-5 21-16 16Zm0 0L16 8",
      grid: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
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
    this.root.append(this.notch, this.address);
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
    this.win.addEventListener("ZenWorkspacesUIUpdate", this.onEvent);
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
      this.ownership.close(event.target);
      return;
    }
    if (
      event.type === "TabSelect" ||
      event.type === "TabAttrModified" ||
      event.type === "ZenWorkspacesUIUpdate"
    ) {
      if (event.type === "TabAttrModified") {
        this.updateAddress();
        return;
      }
      this.panel.hidePopup();
      if (event.type === "ZenWorkspacesUIUpdate") this.path = [];
      this.render();
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
  }
  closeAgentPanel() {
    this.agentPanel.hidden = true;
    this.doc.documentElement.removeAttribute("concept-agent-open");
  }
  notice(text) {
    this.address.textContent = text;
    this.win.setTimeout(() => this.updateAddress(), 3000);
  }
  updateAddress() {
    const tab = this.win.gBrowser.selectedTab;
    const spaces = this.win.gZenWorkspaces.getWorkspaces();
    const index = Math.max(
      0,
      spaces.findIndex((space) => space.uuid === this.spaceId),
    );
    this.address.replaceChildren(
      this.spaceIcon(spaces[index], index),
      this.node(
        "span",
        "concept-address-label",
        (tab?.label || "New Tab").slice(0, 80),
      ),
    );
    this.address.title = this.win.gBrowser.selectedBrowser.currentURI.spec;
    this.address.setAttribute(
      "aria-label",
      "Search or edit address: " + (tab?.label || "New Tab"),
    );
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
  renderShelf() {
    this.shelf.replaceChildren();
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
        this.icon("home"),
        this.node("span", "", active?.name || "Home"),
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
    context = {
      url: this.win.gBrowser.selectedBrowser.currentURI.spec,
      spaceId: this.spaceId,
      ...context,
    };
    this.agentPanel.replaceChildren();
    this.agentPanel.hidden = false;
    this.doc.documentElement.setAttribute("concept-agent-open", "true");
    const header = this.node("div", "concept-agent-header");
    header.append(
      this.agentBody(existingAgent || {}),
      this.node(
        "strong",
        "",
        existingAgent?.persistent ? "Hyper-Agent" : "Agent task",
      ),
      this.node("span", "concept-agent-status", "Draft"),
      this.iconButton("close", "Close agent", () => {
        this.closeAgentPanel();
      }),
    );
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
    if (context.selection)
      this.agentPanel.append(this.node("blockquote", "", context.selection));
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
      "Agent execution is not connected yet. You can save the task and its page context.",
    );
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
    this.win.removeEventListener("ZenWorkspacesUIUpdate", this.onEvent);
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
