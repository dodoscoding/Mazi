import {
  confirmAction,
  el,
  formatDay,
  icon,
  leaveWhile,
  reducedMotion,
  toastNotice,
} from "../ui.js";

export function mount(root, lifecycle) {
  const { fetch, setInterval, setTimeout, URL } = lifecycle;
  const $ = (id) => root.querySelector(`#${id}`);
  let group = null;
  let offset = 0;
  let query = "";
  let groupRoles = new Map();
  const counts = {
    needs: 0,
    loaded: 0,
    pairs: 0,
    events: 0,
    total: 0,
    complete: false,
  };

  root.querySelectorAll("[data-icon]").forEach((slot) => {
    slot.replaceWith(icon(slot.dataset.icon, 26));
  });
  toastNotice($("notice"), lifecycle);

  async function api(path, body) {
    const response = await fetch(
      path,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  function notice(message, tone = "info") {
    $("notice").dataset.tone = tone;
    $("notice").textContent = message;
  }
  async function act(work) {
    try {
      await work();
    } catch (error) {
      notice(error.message, "error");
    }
  }
  function element(tag, value = "", className = "") {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function button(label, work, className = "fx-button fx-button--quiet") {
    const node = element("button", label, className);
    node.type = "button";
    node.addEventListener("click", () => act(() => work(node)));
    return node;
  }
  function image(asset, alt = "Archive photograph") {
    const node = document.createElement("img");
    node.src = `/api/review/rendition/${encodeURIComponent(asset)}`;
    node.alt = alt;
    node.loading = "lazy";
    return node;
  }
  function empty(container, message) {
    if (!container.children.length)
      container.append(element("p", message, "fx-empty"));
  }
  function params(extra = "") {
    return `group=${encodeURIComponent(group)}${extra}`;
  }
  // The timeline API pages 30 items and has no "needs review" total, and
  // undated items sort last, so the date-and-place count only covers the
  // photographs loaded so far and says so until every page is loaded.
  function updateSummary() {
    const partial = counts.loaded < counts.total;
    $("count-items").textContent = counts.needs
      ? `${counts.needs}${partial ? "+" : ""}`
      : "";
    $("count-items").title = partial
      ? `In the first ${counts.loaded} of ${counts.total} photographs`
      : "";
    $("count-duplicates").textContent = counts.pairs
      ? String(counts.pairs)
      : "";
    $("count-events").textContent = counts.events ? String(counts.events) : "";
    const parts = [];
    if (counts.needs)
      parts.push(
        partial
          ? `${counts.needs} of the first ${counts.loaded} photographs ${counts.needs === 1 ? "needs" : "need"} a date or place`
          : `${counts.needs} ${counts.needs === 1 ? "photograph needs" : "photographs need"} a date or place`,
      );
    else if (partial)
      parts.push(
        `The first ${counts.loaded} of ${counts.total} photographs have a date and place`,
      );
    if (counts.pairs)
      parts.push(
        `${counts.pairs} possible ${counts.pairs === 1 ? "duplicate" : "duplicates"}`,
      );
    if (counts.events)
      parts.push(
        `${counts.events} possible ${counts.events === 1 ? "event" : "events"}`,
      );
    $("review-sub").textContent = parts.length
      ? `${parts.join(" · ")}. Changes are shared with the circle, and every choice can be revisited.`
      : "Fix dates and places, settle duplicates and group events. Changes are shared with the circle, and every choice can be revisited.";
    const waiting = counts.needs + counts.pairs + counts.events;
    const done = counts.complete && counts.total > 0 && !waiting;
    $("done").hidden = !done;
    if (done)
      $("done-text").textContent =
        `${counts.total} ${counts.total === 1 ? "photograph has" : "photographs have"} a date and a place, and no duplicate or event suggestions are waiting. Corrections stay open to anyone in the circle.`;
  }

  async function refresh() {
    let groups;
    try {
      groups = await api("/api/groups");
    } catch {
      $("signed-out").hidden = false;
      $("workspace").hidden = true;
      return;
    }
    $("signed-out").hidden = true;
    $("workspace").hidden = false;
    $("groups").replaceChildren();
    groupRoles = new Map(groups.map((item) => [item.id, item.role]));
    for (const item of groups) {
      const option = element("option", item.name);
      option.value = item.id;
      $("groups").append(option);
    }
    root
      .querySelector(".review-group")
      .classList.toggle("is-single", groups.length < 2);
    group =
      groups.find((item) => item.id === (group || lifecycle.groupId))?.id ||
      groups[0]?.id ||
      null;
    $("groups").value = group || "";
    if (group) await refreshGroup();
  }
  async function refreshGroup() {
    offset = 0;
    query = $("query").value;
    $("leave-group").hidden = groupRoles.get(group) !== "member";
    $("export").href = `/api/review/export?${params()}`;
    await Promise.all([timeline(), duplicates(), events(), today(), mine()]);
    updateSummary();
  }

  // Places are stored case-folded; show them as names.
  function titleCase(value) {
    return (value || "").replace(
      /(^|[\s-])(\p{L})/gu,
      (_, gap, letter) => gap + letter.toUpperCase(),
    );
  }
  function issueOf(item) {
    if (!item.date && item.date_basis === "conflicting source evidence")
      return ["Dates disagree", "Source records disagree about the date."];
    if (!item.date)
      return ["Date missing", "No source record carries a capture date."];
    if (!item.place)
      return ["Place missing", "No source record names a place."];
    if (item.date_basis === "reviewed correction")
      return ["Corrected", "The date was set by someone in the circle."];
    return ["Settled", "Date and place come from the source records."];
  }
  function field(label, input, className = "") {
    const wrapper = document.createElement("label");
    wrapper.className = `fix-field ${className}`.trim();
    wrapper.append(element("span", label), input);
    return wrapper;
  }

  async function timeline(more = false) {
    if (!more) {
      offset = 0;
      $("timeline").replaceChildren();
      counts.needs = 0;
      counts.loaded = 0;
    }
    const page = await api(
      `/api/review/timeline?${params(`&offset=${offset}&q=${encodeURIComponent(query)}`)}`,
    );
    $("count").textContent = `${page.total} photographs`;
    counts.total = page.total;
    counts.loaded += page.items.length;
    counts.complete = page.next_offset === null && !query;
    for (const item of page.items) {
      const [issue, why] = issueOf(item);
      const open = !item.date || !item.place;
      if (open) counts.needs++;
      const card = document.createElement("article");
      card.className = `review-card ${open ? "needs-review" : "is-settled"}`;
      const figure = element("figure", "", "review-photo");
      figure.append(
        image(item.id, item.title || "Archive photograph"),
        element("span", issue, `issue-badge ${open ? "is-open" : ""}`),
      );
      const body = element("div", "", "review-body");
      const heading = element("h3", item.title || "Untitled photograph");
      body.append(
        heading,
        element(
          "p",
          `${item.date || "Date unknown"} · ${titleCase(item.place) || "Place unknown"} · ${item.origin_count} source records`,
          "review-meta",
        ),
        element("p", why, "review-why"),
      );
      const original = element("a", "Download original", "fx-text-link");
      original.href = `/api/archive/${encodeURIComponent(item.id)}/original`;
      original.download = item.id;
      const form = document.createElement("form");
      form.className = "fix-form";
      const title = document.createElement("input");
      title.name = "title";
      title.maxLength = 200;
      title.value = item.title;
      const date = document.createElement("input");
      date.name = "capture_date";
      date.type = "date";
      date.value = item.date || "";
      const place = document.createElement("input");
      place.name = "place";
      place.maxLength = 200;
      place.value = item.place || "";
      const anniversary = document.createElement("input");
      anniversary.name = "anniversary";
      anniversary.type = "checkbox";
      anniversary.checked = item.anniversary;
      const when = element("fieldset", "", "fix-group");
      when.append(
        element("legend", "When was this taken?", "fx-label"),
        field("Capture date", date),
      );
      const where = element("fieldset", "", "fix-group");
      where.append(
        element("legend", "Where", "fx-label"),
        field("Place", place),
      );
      const save = element(
        "button",
        "Save correction",
        "fx-button fx-button--primary",
      );
      save.type = "submit";
      const actions = element("div", "", "fix-actions");
      actions.append(save);
      if (item.date_basis === "reviewed correction")
        actions.append(
          button("Clear date correction", async () => {
            // Only the date changes; unsaved edits in the form are not sent.
            await api("/api/review/correct", {
              asset: item.id,
              title: item.title,
              capture_date: null,
              place: item.place || "",
              anniversary: false,
            });
            notice(
              item.anniversary
                ? "Date correction cleared. Source dates apply again, and the On this day approval was removed."
                : "Date correction cleared. Source dates apply again.",
            );
            await refreshGroup();
          }),
        );
      actions.append(original);
      form.append(
        when,
        where,
        field("Title", title, "fix-title"),
        field("Approved for On this day", anniversary, "fix-check"),
        actions,
      );
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        act(async () => {
          await api("/api/review/correct", {
            asset: item.id,
            title: title.value,
            capture_date: date.value || null,
            place: place.value,
            anniversary: anniversary.checked,
          });
          notice("Correction saved for the group.", "success");
          await refreshGroup();
        });
      });
      body.append(form);
      card.append(figure, body);
      $("timeline").append(card);
    }
    offset = page.next_offset ?? 0;
    $("more").hidden = page.next_offset === null;
    empty($("timeline"), "No photographs match this search.");
  }

  function pairFigures(pair) {
    const side = document.createElement("div");
    side.className = "pair";
    for (const [label, asset] of [
      ["First photo", pair.left],
      ["Second photo", pair.right],
    ]) {
      const figure = element("figure", "", "pair-photo");
      figure.append(
        image(asset, `${label} of the pair`),
        element("figcaption", label),
      );
      side.append(figure);
    }
    return side;
  }
  async function duplicates() {
    const [pairs, reviewed] = await Promise.all([
      api(`/api/review/duplicates?${params()}`),
      api(`/api/review/reviewed-pairs?${params()}`),
    ]);
    counts.pairs = pairs.length;
    $("duplicates").replaceChildren();
    $("reviewed-pairs").replaceChildren();
    for (const pair of pairs) {
      const card = document.createElement("article");
      card.className = "pair-card";
      card.append(
        element("p", "Possible duplicate", "fx-label tone-warn"),
        element("h3", "The same photo, imported twice?"),
        pairFigures(pair),
        element(
          "p",
          `${pair.reason} · pixel distance ${pair.distance}`,
          "review-why",
        ),
      );
      const links = element("p", "", "pair-links");
      for (const asset of [pair.left, pair.right]) {
        const link = element("a", `Original ${asset.slice(0, 8)} `);
        link.className = "fx-text-link";
        link.href = `/api/archive/${encodeURIComponent(asset)}/original`;
        link.target = "_blank";
        link.rel = "noopener";
        links.append(link);
      }
      const actions = element("div", "", "pair-actions");
      actions.append(
        button(
          "Merge presentation",
          () =>
            leaveWhile(card, 40, async () => {
              await api("/api/review/pair", {
                group,
                left: pair.left,
                right: pair.right,
                action: "merge",
              });
              notice(
                "Merged for presentation. Originals remain available.",
                "success",
              );
              await duplicates();
              await timeline();
              updateSummary();
            }),
          "fx-button fx-button--primary",
        ),
        button("Keep separate", () =>
          leaveWhile(card, -40, async () => {
            await api("/api/review/pair", {
              group,
              left: pair.left,
              right: pair.right,
              action: "dismiss",
            });
            await duplicates();
            updateSummary();
          }),
        ),
      );
      card.append(links, actions);
      $("duplicates").append(card);
    }
    empty($("duplicates"), "No unreviewed suggestions.");
    for (const pair of reviewed) {
      const card = document.createElement("article");
      card.className = "pair-card is-reviewed";
      card.append(
        pairFigures(pair),
        element(
          "p",
          pair.status === "merged"
            ? "Merged for presentation"
            : "Kept separate",
          "review-why",
        ),
      );
      const actions = element("div", "", "pair-actions");
      if (pair.status === "merged") {
        for (const [label, asset, selected] of [
          ["Use first photo", pair.right, pair.left],
          ["Use second photo", pair.left, pair.right],
        ]) {
          actions.append(
            button(label, async () => {
              await api("/api/review/rendition", { group, asset, selected });
              notice("Preferred rendition saved for the group.", "success");
              await duplicates();
              await timeline();
              updateSummary();
            }),
          );
        }
      }
      actions.append(
        button(
          pair.status === "merged" ? "Split pair" : "Undo decision",
          async () => {
            await api("/api/review/pair", {
              group,
              left: pair.left,
              right: pair.right,
              action: "undo",
            });
            notice("Review decision undone.");
            await duplicates();
            await timeline();
            updateSummary();
          },
        ),
      );
      card.append(actions);
      $("reviewed-pairs").append(card);
    }
    empty($("reviewed-pairs"), "No reviewed pairs yet.");
  }

  async function events() {
    const [candidates, reviewed] = await Promise.all([
      api(`/api/review/events?${params()}`),
      api(`/api/review/reviewed-events?${params()}`),
    ]);
    counts.events = candidates.length;
    $("events").replaceChildren();
    $("reviewed-events").replaceChildren();
    for (const candidate of candidates) {
      const card = document.createElement("article");
      card.className = "event-card";
      card.append(
        element(
          "h3",
          `${formatDay(candidate.date)} · ${titleCase(candidate.place) || "place unknown"}`,
        ),
        element(
          "p",
          `${candidate.assets.length} photographs · ${candidate.reason}`,
          "review-why",
        ),
      );
      const title = document.createElement("input");
      title.placeholder = "Event title";
      title.maxLength = 200;
      title.className = "event-title";
      title.setAttribute("aria-label", "Event title");
      card.append(title);
      const selections = [];
      const grid = element("div", "", "event-photos");
      for (const asset of candidate.assets) {
        const choice = document.createElement("label");
        choice.className = "event-photo";
        const check = document.createElement("input");
        check.type = "checkbox";
        check.checked = true;
        choice.append(
          check,
          image(asset),
          element("span", `Include photo ${asset.slice(0, 8)}`),
        );
        grid.append(choice);
        selections.push([asset, check]);
      }
      card.append(grid);
      const actions = element("div", "", "pair-actions");
      actions.append(
        button(
          "Accept selected photos",
          async () => {
            const selected = selections
              .filter(([, check]) => check.checked)
              .map(([asset]) => asset);
            if (selected.length < 2)
              throw new Error("Select at least two photos for an event.");
            await leaveWhile(card, 40, async () => {
              if (selected.length < candidate.assets.length) {
                await api("/api/review/event", {
                  group,
                  assets: candidate.assets,
                  title: "",
                  decision: "reject",
                });
              }
              await api("/api/review/event", {
                group,
                assets: selected,
                title: title.value,
                decision: "accept",
              });
              await events();
              updateSummary();
            });
          },
          "fx-button fx-button--primary",
        ),
        button("Reject suggestion", () =>
          leaveWhile(card, -40, async () => {
            await api("/api/review/event", {
              group,
              assets: candidate.assets,
              title: "",
              decision: "reject",
            });
            await events();
            updateSummary();
          }),
        ),
      );
      card.append(actions);
      $("events").append(card);
    }
    for (const event of reviewed) {
      const card = document.createElement("article");
      card.className = "event-card is-reviewed";
      card.append(
        element(
          "h3",
          event.title ||
            (event.status === "rejected"
              ? "Rejected suggestion"
              : "Untitled event"),
        ),
        element(
          "p",
          `${event.assets.length} photographs · ${event.status}`,
          "review-why",
        ),
      );
      card.append(
        button("Undo event", async () => {
          await api("/api/review/event", {
            group,
            assets: event.assets,
            title: event.title,
            decision: "undo",
          });
          await events();
          updateSummary();
        }),
      );
      $("reviewed-events").append(card);
    }
    empty($("events"), "No unreviewed event suggestions.");
    empty($("reviewed-events"), "No reviewed events yet.");
  }
  async function today() {
    const items = await api(`/api/review/on-this-day?${params()}`);
    $("today").replaceChildren();
    for (const item of items) {
      const card = document.createElement("article");
      card.className = "thumb-card";
      card.append(
        image(item.id, item.title || "A memory"),
        element("h3", item.title || "A memory"),
        element("p", formatDay(item.date), "review-why"),
      );
      $("today").append(card);
    }
    empty($("today"), "No approved memories for today.");
  }
  async function mine() {
    const items = await api(`/api/review/my-contributions?${params()}`);
    $("mine").replaceChildren();
    for (const item of items) {
      const card = document.createElement("article");
      card.className = "thumb-card";
      card.append(
        image(item.asset, item.filename),
        element("h3", item.filename),
      );
      card.append(
        button(
          "Remove my source record",
          async () => {
            const sure = await confirmAction(root, {
              title: "Stop sharing this source record?",
              body: `${item.filename} stops being shared with the circle at once. Copies other members imported themselves stay. Files someone already downloaded cannot be recalled.`,
              confirm: "Remove source record",
              cancel: "Keep sharing",
              danger: true,
            });
            if (!sure) return;
            await api("/api/review/delete-contribution", { origin: item.id });
            notice("Your source record is no longer shared.");
            await refreshGroup();
          },
          "fx-button fx-button--danger-quiet",
        ),
      );
      $("mine").append(card);
    }
    empty($("mine"), "You have no active source records in this group.");
  }

  root.querySelectorAll("[data-jump]").forEach((jump) =>
    jump.addEventListener("click", () => {
      const target = $(jump.dataset.jump);
      target.tabIndex = -1;
      target.scrollIntoView({
        behavior: reducedMotion() ? "auto" : "smooth",
        block: "start",
      });
      target.focus({ preventScroll: true });
    }),
  );
  $("groups").addEventListener("change", () =>
    act(async () => {
      group = lifecycle.selectGroup($("groups"));
      await refreshGroup();
    }),
  );
  $("leave-group").addEventListener("click", () =>
    act(async () => {
      const sure = await confirmAction(root, {
        title: "Leave this circle?",
        body: "The atlas closes for you at once and your contributions stop being shared. Take a copy first if you want one.",
        confirm: "Leave and withdraw",
        cancel: "Stay",
        danger: true,
      });
      if (!sure) return;
      await api("/api/review/leave-group", { group });
      group = null;
      notice("You left the group. Your contributions are no longer shared.");
      await refresh();
    }),
  );
  $("search").addEventListener("submit", (event) => {
    event.preventDefault();
    act(async () => {
      query = $("query").value;
      await timeline();
      updateSummary();
    });
  });
  $("more").addEventListener("click", () =>
    act(async () => {
      await timeline(true);
      updateSummary();
    }),
  );
  act(refresh);
}
