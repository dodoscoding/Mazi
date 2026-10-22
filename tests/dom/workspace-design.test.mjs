import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Window } from "happy-dom";

const source = (path) =>
  readFile(new URL(`../../src/${path}`, import.meta.url), "utf8");

test("import guidance, source choice and native upload remain in their reading order", async (t) => {
  const window = new Window();
  t.after(() => window.happyDOM.abort());
  const root = window.document.createElement("main");
  root.innerHTML = await source("features/imports/template.html");
  const steps = root.querySelector('ol[aria-label="Import steps"]');
  assert.deepEqual(
    [...(steps?.children ?? [])].map((item) => item.textContent.trim()),
    ["Upload your export", "Inspect its inventory", "Import to your circle"],
  );
  const composer = root.querySelector(".import-composer");
  assert.deepEqual(
    [...composer.children].map((item) => item.id),
    ["source-cards", "upload"],
  );
  const upload = root.querySelector("#upload");
  assert.deepEqual(
    [...upload.elements].map((item) => item.name || item.id),
    ["source", "namespace", "date_order", "file", "upload-button"],
  );
  assert.equal(upload.querySelector('[name="file"]').type, "file");
  assert.equal(upload.querySelector('[name="file"]').required, true);
  assert.equal(upload.querySelector('[name="namespace"]').maxLength, 200);
  assert.equal(root.querySelector("#report").hidden, true);
  assert.equal(root.querySelector("#workspace-error").hidden, true);
  assert.equal(root.querySelector("#report-title").tabIndex, -1);
});

test("working page styles are scoped and cannot override hidden controls or reorder keyboard flow", async (t) => {
  const window = new Window();
  t.after(() => window.happyDOM.abort());
  for (const path of [
    "features/workspace.css",
    "features/imports/imports.css",
  ]) {
    const css = await source(path);
    const style = window.document.createElement("style");
    style.textContent = css;
    window.document.head.append(style);
    const visit = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules) visit(rule.cssRules);
        if (!rule.selectorText) continue;
        const selectors = rule.selectorText.match(/(?:[^,(]|\([^)]*\))+/g);
        for (const selector of selectors)
          assert.match(
            selector.trim(),
            /^(?:\.feature-(?:content|page)\b|\.fx-imports\b|\[data-theme="day"\] \.feature-page\b)/,
          );
        assert.equal(rule.style.getPropertyValue("order"), "");
        assert.equal(rule.style.getPropertyPriority("display"), "");
      }
    };
    visit(style.sheet.cssRules);
  }
  const root = window.document.createElement("section");
  root.className = "feature-content";
  root.innerHTML = await source("features/imports/template.html");
  const base = window.document.createElement("style");
  base.textContent = await source("features/features.css");
  window.document.head.prepend(base);
  window.document.body.append(root);
  for (const selector of [
    "#workspace",
    "#workspace-error",
    "#report",
    "#report-error",
    "#circle-view",
  ])
    assert.equal(
      window.getComputedStyle(root.querySelector(selector)).display,
      "none",
      selector,
    );
});

test("Search keeps its page heading visible above the search form", async (t) => {
  const window = new Window();
  t.after(() => window.happyDOM.abort());
  const root = window.document.createElement("section");
  root.className = "feature-content";
  root.innerHTML = await source("features/discovery/template.html");
  root.querySelector(".discovery-page").dataset.view = "search";
  window.document.body.append(root);
  for (const path of [
    "features/features.css",
    "features/discovery/discovery.css",
    "features/workspace.css",
  ]) {
    const style = window.document.createElement("style");
    style.textContent = await source(path);
    window.document.head.append(style);
  }
  const header = root.querySelector(".disc-head");
  assert.equal(window.getComputedStyle(header).position || "static", "static");
  assert.equal(window.getComputedStyle(header).display, "flex");
  assert.equal(root.querySelector("h1").id, "discovery-title");
  assert.ok(
    header.compareDocumentPosition(root.querySelector("#search-form")) & 4,
  );
});
