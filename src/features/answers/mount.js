import { el, formatDay, icon, reducedMotion, sheet } from "../ui.js";

const wordDelay = 30;

export function mount(root, lifecycle) {
  const { fetch, setInterval, setTimeout, URL } = lifecycle;
  const $ = (id) => root.querySelector(`#${id}`);
  const page = root.querySelector(".fx");
  let group = "",
    revision = 0,
    groups = [],
    evidenceSheet = null;
  function node(tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }
  async function api(path, body) {
    const response = await fetch(
      path,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {},
    );
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Request failed");
    return data;
  }
  function clear() {
    revision++;
    $("answer").replaceChildren();
    $("answer").removeAttribute("aria-busy");
    $("notice").textContent = "";
    $("notice").dataset.state = "";
    $("evidence-panel").hidden = true;
    $("evidence-list").replaceChildren();
    delete page.dataset.asked;
  }
  function usage(value) {
    $("usage").textContent =
      `${value.requests} / ${value.daily_limit} requests today (UTC). Provider cost: €0. Local infrastructure cost is not measured.`;
  }
  async function refresh() {
    clear();
    $("private").hidden = true;
    const current = revision;
    try {
      const state = await api(
        "/api/answers/state?group=" + encodeURIComponent(group),
      );
      if (current !== revision) return;
      $("personal").checked = state.contribution_enabled;
      $("group-enabled").checked = state.group_enabled;
      $("admin").hidden = groups.find((g) => g.id === group)?.role !== "admin";
      usage(state.usage);
      $("private").hidden = false;
    } catch (error) {
      if (current === revision) $("notice").textContent = error.message;
    }
  }

  // The answer arrives whole; it is revealed at 30 ms a word, and each
  // citation and evidence row appears as the text reaches it. Unrevealed
  // words are hidden rather than faded, so nothing on screen is ever half-legible.
  function streamer(animate) {
    const steps = [];
    return {
      words(parent, text) {
        for (const part of text.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            parent.append(part);
            continue;
          }
          const word = el("span", "", part);
          if (animate) {
            word.hidden = true;
            steps.push([word]);
          }
          parent.append(word);
        }
      },
      add(node, className = "") {
        if (!animate) return;
        node.hidden = true;
        if (className) node.classList.add(className);
        steps.push([node]);
      },
      with(node) {
        if (!animate) return;
        node.hidden = true;
        node.classList.add("stream-in");
        steps[steps.length - 1]?.push(node);
      },
      start(done) {
        if (!animate || !steps.length) return done();
        let index = 0;
        const timer = setInterval(() => {
          const step = steps[index++];
          if (!step || !step[0].isConnected) {
            clearInterval(timer);
            done();
            return;
          }
          step.forEach((node) => (node.hidden = false));
        }, wordDelay);
      },
    };
  }
  function evidenceItem(evidence, number) {
    const item = el("li", "evidence-item");
    const chip = el("span", "cite-number", String(number));
    chip.setAttribute("aria-hidden", "true");
    const thumb = document.createElement("img");
    thumb.src = `/api/archive/${encodeURIComponent(evidence.id)}/preview`;
    thumb.alt = "";
    thumb.loading = "lazy";
    const text = el("div", "evidence-text");
    const link = el("a", "evidence-title", evidence.title);
    link.href =
      "/answer-evidence?" + new URL(evidence.url, location.origin).searchParams;
    link.setAttribute(
      "aria-label",
      `Source ${number}: ${evidence.title}, open the supporting record`,
    );
    text.append(
      el(
        "p",
        "fx-label evidence-kind",
        `Photograph · ${evidence.date ? formatDay(evidence.date) : evidence.dates.length > 1 ? "Dates disagree" : "Date unknown"}`,
      ),
      link,
      el(
        "p",
        "fx-small",
        [evidence.place || "Place unknown", evidence.date_basis].join(" · "),
      ),
    );
    item.append(chip, thumb, text);
    return item;
  }
  function renderSupported(result, question) {
    const animate = !reducedMotion();
    const stream = streamer(animate);
    const panel = el("div", "answer");
    panel.append(el("h2", "asked", question));
    const body = el("div", "answer-text");
    const lede = el("p", "answer-lede");
    stream.words(lede, result.message);
    body.append(lede);
    const numbers = new Map();
    const items = [];
    for (const claim of result.claims) {
      const p = el("p");
      stream.words(p, claim.text);
      for (const id of claim.evidence_ids) {
        const evidence = result.evidence.find((item) => item.id === id);
        p.append(" ");
        const link = node("a", "");
        link.className = "cite";
        link.href =
          "/answer-evidence?" +
          new URL(evidence.url, location.origin).searchParams;
        p.append(link);
        stream.add(link, "stream-pop");
        if (!numbers.has(id)) {
          numbers.set(id, numbers.size + 1);
          const item = evidenceItem(evidence, numbers.size);
          items.push(item);
          stream.with(item);
        }
        link.textContent = String(numbers.get(id));
        // The visible chip is the source number; the name matches the evidence view it opens.
        link.setAttribute("aria-label", "View supporting record");
        link.title = `Source ${numbers.get(id)}: ${evidence.title}`;
      }
      body.append(p);
    }
    for (const message of result.uncertainty) {
      const p = el("p", "answer-uncertain");
      stream.words(p, message);
      body.append(p);
    }
    if (result.matching_records > result.shown) {
      const p = el("p", "fx-small");
      stream.words(
        p,
        `Showing ${result.shown} of ${result.matching_records} matching records.`,
      );
      body.append(p);
    }
    panel.append(body);
    const coverage = el("p", "fx-small answer-coverage");
    stream.words(coverage, result.coverage);
    panel.append(coverage);
    const count = `${items.length} ${items.length === 1 ? "source" : "sources"}`;
    $("evidence-count").textContent = count;
    $("evidence-list").replaceChildren(...items);
    $("evidence-panel").hidden = !items.length;
    const toggle = el("button", "fx-pill-button evidence-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.append(`Evidence · ${count}`, icon("chevron", 14));
    toggle.addEventListener("click", () => {
      if (!evidenceSheet)
        evidenceSheet = sheet(root, {
          label: "Evidence for this answer",
          className: "evidence-sheet",
        });
      const list = $("evidence-list").cloneNode(true);
      list.removeAttribute("id");
      const head = el("div", "fx-section-row");
      head.append(
        el("h2", "fx-sheet-title", "Evidence"),
        el("span", "fx-label", count),
      );
      evidenceSheet.body.replaceChildren(head, list);
      evidenceSheet.open();
    });
    if (items.length) {
      panel.append(toggle);
      stream.add(toggle);
    }
    const current = revision;
    if (animate) $("answer").setAttribute("aria-busy", "true");
    queueMicrotask(() =>
      stream.start(() => {
        if (current === revision) $("answer").removeAttribute("aria-busy");
      }),
    );
    return panel;
  }
  function go(path) {
    location.hash = `#${path}`;
  }
  function renderAbstained(result, question) {
    const panel = el("div", "answer answer--none");
    const label = el("p", "fx-label answer-none-label");
    label.append(icon("alert", 14), "No evidence found");
    panel.append(
      el("h2", "asked", question),
      label,
      el("p", "answer-lede", "The archive doesn’t say, so Mazi won’t guess."),
      el("p", "", result.message),
    );
    for (const message of result.uncertainty)
      panel.append(el("p", "answer-uncertain", message));
    panel.append(el("p", "fx-small answer-coverage", result.coverage));
    const next = el("div", "answer-next");
    for (const [label, path] of [
      ["Search the archive instead", "/search"],
      ["Check My Imports", "/imports"],
    ]) {
      const button = el("button", "fx-pill-button", label);
      button.type = "button";
      button.addEventListener("click", () => go(path));
      next.append(button);
    }
    panel.append(next);
    return panel;
  }
  function renderThinking(question) {
    const panel = el("div", "answer answer--thinking");
    panel.append(el("h2", "asked", question));
    const lines = el("div", "skeleton-lines");
    lines.setAttribute("aria-hidden", "true");
    for (const width of [92, 84, 60]) {
      const line = el("i");
      line.style.width = `${width}%`;
      lines.append(line);
    }
    const stop = el("button", "fx-pill-button", "Stop");
    stop.type = "button";
    stop.addEventListener("click", () => {
      clear();
      $("ask").disabled = false;
      $("notice").textContent = "Stopped. Nothing was kept.";
      $("question").focus();
    });
    panel.append(lines, stop);
    return panel;
  }

  $("groups").onchange = () => {
    group = lifecycle.selectGroup($("groups"));
    refresh();
  };
  for (const [id, groupWide] of [
    ["personal", false],
    ["group-enabled", true],
  ]) {
    $(id).onchange = async () => {
      clear();
      try {
        await api("/api/answers/processing", {
          group,
          enabled: $(id).checked,
          group_wide: groupWide,
        });
        await refresh();
      } catch (error) {
        $("notice").textContent = error.message;
      }
    };
  }
  $("ask-form").onsubmit = async (event) => {
    event.preventDefault();
    clear();
    const current = revision;
    const question = $("question").value;
    page.dataset.asked = "true";
    $("ask").disabled = true;
    $("notice").dataset.state = "thinking";
    $("notice").textContent = "Checking archive evidence…";
    $("answer").append(renderThinking(question));
    try {
      const result = await api("/api/answers/ask", {
        group,
        question,
      });
      if (current !== revision) return;
      $("notice").dataset.state = "";
      $("notice").textContent =
        result.status === "supported"
          ? "Evidence found."
          : "Not enough evidence.";
      $("answer").replaceChildren(
        result.status === "supported"
          ? renderSupported(result, question)
          : renderAbstained(result, question),
      );
      usage(result.usage);
    } catch (error) {
      if (current === revision) {
        $("answer").replaceChildren();
        $("notice").dataset.state = "";
        $("notice").textContent = error.message;
      }
    } finally {
      if (current === revision) $("ask").disabled = false;
    }
  };
  (async () => {
    try {
      groups = await api("/api/groups");
      for (const g of groups) {
        const option = node("option", g.name);
        option.value = g.id;
        $("groups").append(option);
      }
      root
        .querySelector(".ask-group")
        .classList.toggle("is-single", groups.length < 2);
      group = lifecycle.selectGroup($("groups"));
      if (group) await refresh();
    } catch (error) {
      $("notice").textContent = error.message + ". Sign in from Imports.";
    }
  })();
}
