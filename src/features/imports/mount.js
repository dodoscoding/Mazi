import { groupDestinations } from "../../navigation.ts";
import {
  confirmAction,
  el,
  icon,
  initials,
  sheet,
  sourceIcons,
  sourceNames,
  toastNotice,
} from "../ui.js";

const sources = [
  {
    id: "whatsapp",
    how: "Open the chat, choose Export chat and include media. Gives a .zip.",
  },
  {
    id: "discord",
    how: "In Discord settings, request your data package. Add the .zip they send.",
  },
  {
    id: "messenger",
    how: "Download your information with Messages in JSON format, as a .zip.",
  },
  {
    id: "manual",
    how: "Put JPEG or PNG photos in one .zip on your computer.",
  },
];
const stateLabels = {
  UPLOADING: "Uploading",
  SCANNING: "Reading the export",
  INVENTORIED: "Awaiting your confirmation",
  PROCESSING: "Importing now",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
  FAILED: "Import stopped",
};
const stateTone = {
  COMPLETED: "ok",
  CANCELLED: "muted",
  FAILED: "error",
};
const activeOutcomes = ["PENDING", "PROCESSING", "RETRY_REQUESTED"];
const terminalStates = ["COMPLETED", "CANCELLED", "FAILED"];

export function mount(root, lifecycle) {
  const { fetch, setInterval, setTimeout, URL } = lifecycle;
  const $ = (id) => root.querySelector(`#${id}`);
  const settingsMode =
    location.hash.startsWith("#/settings") || location.pathname === "/settings";
  const circleMode =
    settingsMode ||
    location.hash.startsWith("#/circle") ||
    location.pathname === "/circle";
  const addMode =
    location.hash.startsWith("#/add") || location.pathname === "/add";
  let group = null;
  let groups = [];
  let selectedRun = null;
  let reportOffset = 0;
  let reportRequest = 0;
  let galleryOffset = 0;
  let galleryRequest = 0;
  let galleryLoading = false;
  let polling = false;
  let currentReport = null;
  let gallerySignature = "";
  let picker = null;

  root.querySelectorAll("[data-icon]").forEach((slot) => {
    slot.replaceWith(icon(slot.dataset.icon, 22));
  });
  toastNotice($("notice"), lifecycle);
  root.querySelector(".fx").dataset.mode = circleMode ? "circle" : "imports";
  if (addMode) $("page-title").textContent = "Add";
  if (circleMode) {
    $("page-title").textContent = settingsMode ? "Settings" : "Grubumuz";
    if (settingsMode) {
      $("circle-title").textContent = "Members";
      $("group-settings-heading").closest("section").hidden = true;
    }
    $("page-sub").textContent =
      "Bu arşivi paylaşan arkadaşlarımız. Buradaki içerik grubumuza özel.";
    const shortcuts = el("nav");
    shortcuts.className = "group-destinations";
    shortcuts.setAttribute("aria-label", "Grup araçları");
    for (const entry of groupDestinations) {
      const link = el("a");
      link.href = `#${entry.path}`;
      link.setAttribute("aria-label", entry.label);
      link.append(
        el("strong", "", entry.label),
        el("span", "", entry.description),
      );
      shortcuts.append(link);
    }
    if (!settingsMode) root.querySelector(".fx-head").after(shortcuts);
  }

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
    if (!response.ok)
      throw new Error(data.error || "Request failed. Please retry.");
    if (/^\/api\/imports\/(finish|confirm|retry)$/.test(path))
      window.dispatchEvent(new Event("mazi:work"));
    return data;
  }
  function notice(message, tone = "info") {
    $("notice").dataset.tone = tone;
    $("notice").textContent = message;
  }
  async function run(action) {
    try {
      await action();
    } catch (error) {
      notice(error.message, "error");
    }
  }
  function words(value) {
    return value.toLowerCase().replaceAll("_", " ");
  }
  function textElement(tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }
  function button(label, action, className = "fx-button fx-button--quiet") {
    const element = textElement("button", label);
    element.type = "button";
    element.className = className;
    element.addEventListener("click", () => run(action));
    return element;
  }
  function bytes(value) {
    if (!value) return "0 KB";
    const units = ["bytes", "KB", "MB", "GB"];
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index++;
    }
    return `${value.toLocaleString(undefined, { maximumFractionDigits: index > 1 ? 1 : 0 })} ${units[index]}`;
  }

  function renderSourceCards() {
    const select = root.querySelector("#upload select[name=source]");
    const cards = $("source-cards");
    cards.replaceChildren();
    for (const source of sources) {
      const card = el("div", "source-card");
      const badge = el("span", "source-badge");
      badge.append(icon(sourceIcons[source.id]));
      const choose = el("button", "fx-button fx-button--quiet");
      choose.type = "button";
      choose.textContent = "Choose";
      choose.setAttribute("aria-label", `Choose ${sourceNames[source.id]}`);
      choose.setAttribute("aria-pressed", String(select.value === source.id));
      choose.addEventListener("click", () => {
        select.value = source.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        root.querySelector("#upload input[name=namespace]").focus();
      });
      card.append(
        badge,
        el("b", "", sourceNames[source.id]),
        el("span", "fx-small", source.how),
        choose,
      );
      cards.append(card);
    }
    const apple = el("div", "source-card source-card--link");
    const badge = el("span", "source-badge");
    badge.append(icon("photo"));
    const connect = el("a", "fx-text-link", "Connect in Places & sources");
    connect.href = "/places";
    apple.append(
      badge,
      el("b", "", "Apple Photos"),
      el(
        "span",
        "fx-small",
        "Apple Photos connects through the macOS companion instead of a file.",
      ),
      connect,
    );
    cards.append(apple);
  }
  function syncSource() {
    const select = root.querySelector("#upload select[name=source]");
    $("date-order").hidden = select.value !== "whatsapp";
    root
      .querySelectorAll("#source-cards button[aria-pressed]")
      .forEach((choice, index) =>
        choice.setAttribute(
          "aria-pressed",
          String(sources[index].id === select.value),
        ),
      );
  }

  async function refresh() {
    try {
      groups = await api("/api/groups");
    } catch (error) {
      $("workspace").hidden = true;
      $("workspace-error-text").textContent = error.message;
      $("workspace-error").hidden = false;
      return;
    }
    $("workspace-error").hidden = true;
    $("workspace").hidden = false;
    $("groups").replaceChildren();
    for (const item of groups) {
      const option = textElement("option", item.name);
      option.value = item.id;
      $("groups").append(option);
    }
    group =
      groups.find((item) => item.id === (group?.id || lifecycle.groupId)) ||
      groups[0] ||
      null;
    $("groups").value = group?.id || "";
    $("groups").onchange = () =>
      run(async () => {
        group = groups.find((item) => item.id === $("groups").value);
        await selectGroup();
      });
    await selectGroup();
  }

  function chooseGroup(id) {
    if (id === group?.id) return;
    $("groups").value = id;
    $("groups").dispatchEvent(new Event("change", { bubbles: true }));
  }
  function renderCircles() {
    const list = $("circle-list");
    list.replaceChildren();
    const row = (item) => {
      const choice = el("button", "circle-choice");
      choice.type = "button";
      const current = item.id === group?.id;
      choice.setAttribute("aria-pressed", String(current));
      const avatar = el("span", "circle-avatar", initials(item.name));
      avatar.setAttribute("aria-hidden", "true");
      const text = el("span", "circle-choice-text");
      text.append(
        el("b", "", item.name),
        el("span", "", item.role === "admin" ? "You are an admin" : "Member"),
      );
      choice.append(avatar, text);
      if (current) choice.append(icon("check", 18));
      choice.addEventListener("click", () => {
        picker?.close();
        chooseGroup(item.id);
      });
      return choice;
    };
    for (const item of groups) list.append(row(item));
    const multiple = groups.length > 1;
    root.querySelector(".fx").dataset.circles = multiple ? "many" : "one";
    const pick = $("circle-picker");
    pick.hidden = !multiple;
    if (!multiple) return;
    pick.replaceChildren(
      el("span", "", `${group?.name || "Choose a circle"}`),
      icon("chevron", 14),
    );
    pick.setAttribute("aria-label", `Switch circle, current ${group?.name}`);
    if (!picker) {
      picker = sheet(root, { label: "Switch circle" });
      pick.addEventListener("click", () => {
        picker.body.replaceChildren(
          el("h2", "fx-sheet-title", "Your circles"),
          el(
            "p",
            "fx-small",
            "Each circle is its own private atlas. Nothing crosses between them.",
          ),
          ...groups.map(row),
        );
        picker.open();
      });
    }
  }

  async function renderMembers() {
    const members = await api("/api/members?group=" + group.id);
    let self = "";
    try {
      self = (await api("/api/session")).user_id;
    } catch {
      self = "";
    }
    $("page-sub").textContent =
      `${group.name} · ${members.length} ${members.length === 1 ? "member" : "members"}`;
    $("members").replaceChildren();
    for (const [index, member] of members.entries()) {
      const name = member.display_name || member.email;
      const row = el("li", "member");
      row.style.setProperty("--i", String(index));
      const avatar = el(
        "span",
        `member-avatar member-avatar--${index % 6}`,
        initials(name),
      );
      avatar.setAttribute("aria-hidden", "true");
      const text = el("span", "member-text");
      text.append(
        el("b", "member-name", name),
        el(
          "span",
          "member-meta",
          [
            member.id === self ? "You" : "",
            member.role === "admin" ? "Admin" : "Member",
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      );
      row.append(avatar, text);
      if (group.role === "admin" && member.role !== "admin") {
        const remove = el("button", "fx-button fx-button--danger-quiet");
        remove.type = "button";
        remove.append("Remove ", el("span", "visually-hidden", name));
        remove.addEventListener("click", () =>
          run(async () => {
            const sure = await confirmAction(root, {
              title: `Remove ${name} from ${group.name}?`,
              body: "The atlas closes for them at once, and what they added is withdrawn from the circle. Copies other members imported themselves stay.",
              confirm: "Remove member",
              cancel: "Keep them",
              danger: true,
            });
            if (!sure) return;
            await api("/api/member/remove", {
              group: group.id,
              user: member.id,
            });
            notice("Membership and that member’s contributions withdrawn.");
            await selectGroup();
          }),
        );
        row.append(remove);
      }
      $("members").append(row);
    }
  }

  async function selectGroup() {
    selectedRun = null;
    currentReport = null;
    gallerySignature = "";
    $("report").hidden = true;
    $("group-work").hidden = !group || circleMode;
    $("circle-view").hidden = !group || !circleMode;
    // Members stagger in when the list first appears, not on every refresh.
    if ($("members").childElementCount) $("members").dataset.settled = "";
    $("members").replaceChildren();
    if (!group) return;
    if (circleMode) {
      renderCircles();
      await renderMembers();
      return;
    }
    await refreshImports();
    await gallery();
  }

  async function refreshImports() {
    if (!group) return;
    const imports = await api("/api/imports?group=" + group.id);
    // Rows stagger in when the list first appears, not on every refresh.
    if ($("imports").childElementCount) $("imports").dataset.settled = "";
    $("imports").replaceChildren();
    $("page-sub").textContent = imports.length
      ? `Every export you added to ${group.name} · ${imports.length} ${imports.length === 1 ? "import" : "imports"}`
      : `Exports you add are shared with everyone in ${group.name}.`;
    for (const item of imports) {
      const row = button(
        "",
        async () => {
          selectedRun = item.id;
          reportOffset = 0;
          markSelected();
          await refreshReport();
          $("report-title").focus();
        },
        "history-row",
      );
      row.dataset.run = item.id;
      const name = el("span", "history-name");
      const badge = el("span", "source-badge source-badge--small");
      badge.append(icon(sourceIcons[item.source] || "zip", 16));
      name.append(badge, el("b", "", sourceNames[item.source] || item.source));
      const status = el(
        "span",
        `history-status tone-${item.withdrawn ? "muted" : stateTone[item.state] || "active"}`,
      );
      status.append(
        el("i", "status-dot"),
        item.withdrawn
          ? "Withdrawn"
          : stateLabels[item.state] || words(item.state),
      );
      const when = el(
        "span",
        "history-when",
        new Date(item.created_at * 1000).toLocaleString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      row.append(name, status, when);
      $("imports").append(row);
    }
    $("first-import").hidden = imports.length > 0;
    root.querySelector(".fx").classList.toggle("is-first", !imports.length);
    $("history").classList.toggle("is-empty", !imports.length);
    if (!imports.length)
      $("imports").textContent = "Your import reports will appear here.";
    markSelected();
  }
  function markSelected() {
    root.querySelectorAll("#imports .history-row").forEach((row) => {
      if (row.dataset.run === selectedRun)
        row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
  }

  function renderProgress(report) {
    const records = report.discovered || 0;
    const total = Math.max(0, records - (report.no_media || 0));
    const active = activeOutcomes.reduce(
      (sum, key) => sum + (report.counts[key] || 0),
      0,
    );
    const shared = report.counts.AVAILABLE_TO_GROUP || 0;
    let percent;
    if (report.state === "UPLOADING")
      percent = report.size ? (report.received * 100) / report.size : 0;
    else if (["SCANNING", "INVENTORIED"].includes(report.state)) percent = 0;
    else if (report.state === "COMPLETED") percent = 100;
    else percent = total ? ((total - active) * 100) / total : 0;
    percent = Math.max(0, Math.min(100, Math.round(percent)));
    $("report-bar").setAttribute("aria-valuenow", String(percent));
    $("report-bar").style.setProperty("--progress", `${percent}%`);
    $("report-bar").dataset.tone = stateTone[report.state] || "active";
    $("report-state").textContent = report.withdrawn
      ? "Withdrawn"
      : stateLabels[report.state] || words(report.state);
    $("report-state").hidden = report.state === "FAILED";
    $("report-state").dataset.tone = report.withdrawn
      ? "muted"
      : stateTone[report.state] || "active";
    const order = [
      "UPLOADING",
      "SCANNING",
      "INVENTORIED",
      "PROCESSING",
      "COMPLETED",
    ];
    const at = order.indexOf(report.state);
    const steps = [
      [
        report.state === "UPLOADING"
          ? `Uploading · ${bytes(report.received)} of ${bytes(report.size)}`
          : `Uploaded ${bytes(report.size)}`,
        0,
      ],
      [
        at > 1
          ? `Read ${records} ${records === 1 ? "record" : "records"}`
          : "Reading the export",
        1,
      ],
      [
        `${shared} ${shared === 1 ? "photo" : "photos"} visible to the circle`,
        3,
      ],
      ["Finished", 4],
    ];
    $("report-steps").replaceChildren(
      ...steps.map(([label, index]) => {
        const done = at > index || report.state === "COMPLETED";
        const current = at === index;
        const step = el(
          "li",
          `report-step ${done ? "is-done" : current ? "is-current" : ""}`,
        );
        const mark = done ? icon("check", 16) : el("i", "step-mark");
        if (!done) mark.setAttribute("aria-hidden", "true");
        step.append(mark, label);
        return step;
      }),
    );
    $("report-steps").hidden = ["FAILED", "CANCELLED"].includes(report.state);
    $("report-error").hidden = report.state !== "FAILED";
    if (report.state === "FAILED")
      $("report-error-text").textContent =
        `${report.error || "The export could not be read."}${shared ? "" : " Nothing from it was shared with the circle."}`;
  }

  async function refreshReport() {
    if (!selectedRun) return;
    const id = selectedRun;
    const offset = reportOffset;
    const request = ++reportRequest;
    const report = await api(`/api/imports/${id}?offset=${offset}`);
    if (request !== reportRequest || offset !== reportOffset) return;
    await showReport(id, report);
  }

  async function showReport(id, report) {
    if (selectedRun !== id) return;
    currentReport = report;
    $("report").hidden = false;
    $("report-title").textContent =
      `${sourceNames[report.source] || report.source} · ${words(report.state)}`;
    const noMedia = report.no_media || 0;
    const summary = [
      `${report.discovered} records scanned`,
      `${Math.max(0, report.discovered - noMedia)} media candidates`,
      noMedia ? `${noMedia} without media` : "",
      ...Object.entries(report.counts)
        .map(([key, count]) => [
          key,
          key === "SKIPPED" ? count - noMedia : count,
        ])
        .filter(([, count]) => count > 0)
        .map(([key, count]) => `${count} ${words(key)}`),
      `${report.unique_assets} unique photos`,
      report.withdrawn ? "Contribution withdrawn" : "",
      report.error ? words(report.error) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    if ($("report-summary").textContent !== summary)
      $("report-summary").textContent = summary;
    $("coverage").textContent = report.coverage;
    renderProgress(report);
    $("confirm").hidden = report.state !== "INVENTORIED";
    $("cancel").hidden = ["COMPLETED", "CANCELLED", "FAILED"].includes(
      report.state,
    );
    $("withdraw").hidden =
      report.withdrawn ||
      !(
        report.counts.AVAILABLE_TO_GROUP ||
        (report.no_media &&
          !["UPLOADING", "SCANNING", "INVENTORIED"].includes(report.state))
      );
    $("transfer").value = Math.round((report.received * 100) / report.size);
    const tableSignature = JSON.stringify(report.items);
    if ($("items").dataset.signature !== tableSignature) {
      $("items").dataset.signature = tableSignature;
      $("items").replaceChildren();
      for (const item of report.items) {
        const row = document.createElement("tr");
        const outcome = textElement("td", "");
        outcome.append(
          el(
            "span",
            `outcome outcome--${item.outcome === "AVAILABLE_TO_GROUP" ? "ok" : item.outcome === "FAILED" ? "error" : activeOutcomes.includes(item.outcome) ? "active" : "muted"}`,
            words(item.outcome),
          ),
        );
        row.append(textElement("td", item.filename || item.locator), outcome);
        const details = textElement(
          "td",
          [words(item.reason), ...item.warnings.map(words)].join(" · "),
        );
        if (
          item.outcome === "FAILED" &&
          ["RETRY_LIMIT", "INVALID_MEDIA"].includes(item.reason) &&
          !report.withdrawn &&
          report.state !== "CANCELLED"
        ) {
          details.append(
            button("Retry item", async () => {
              await api("/api/imports/retry", { id, item: item.id });
              await refreshReport();
            }),
          );
        }
        row.append(details);
        $("items").append(row);
      }
    }
    $("previous").hidden = reportOffset === 0;
    $("next").hidden = report.next_offset === null;
    const signature = JSON.stringify([report.counts, report.withdrawn]);
    if (signature !== gallerySignature) {
      gallerySignature = signature;
      await gallery();
    }
  }

  async function gallery(more = false) {
    if (!group || (more && galleryLoading)) return;
    const request = ++galleryRequest;
    const offset = more ? galleryOffset : 0;
    galleryLoading = true;
    try {
      if (!more) {
        galleryOffset = 0;
        $("gallery").replaceChildren();
      }
      const items = await api(
        `/api/archive?group=${group.id}&offset=${offset}`,
      );
      if (request !== galleryRequest) return;
      for (const item of items) {
        const article = document.createElement("article");
        article.className = "shared-photo";
        const image = document.createElement("img");
        image.src = `/api/archive/${item.id}/preview`;
        image.alt = item.origins[0]?.original_filename || "Imported photograph";
        image.loading = "lazy";
        article.append(image);
        const download = textElement("a", "Download original");
        download.href = `/api/archive/${item.id}/original`;
        download.download = item.origins[0]?.original_filename || "original";
        download.className = "fx-text-link";
        article.append(download);
        const details = document.createElement("details");
        details.append(
          textElement(
            "summary",
            `${item.origin_count} source record${item.origin_count === 1 ? "" : "s"} · dates and conversation`,
          ),
        );
        const sourceRecords = document.createElement("div");
        sourceRecords.className = "source-records";
        details.append(sourceRecords);
        function appendOrigins(origins) {
          for (const origin of origins) {
            sourceRecords.append(
              textElement(
                "p",
                `${words(origin.source_type)} · ${origin.sender.label || "Source sender unknown"}\nShared: ${origin.shared_at_assertion.raw ?? "Unknown"}\nCapture: ${origin.capture_assertions.map((a) => a.raw).join(", ") || "Unknown"}`,
              ),
            );
            for (const message of origin.context)
              sourceRecords.append(
                textElement(
                  "p",
                  `${message.sender?.label || "Source message"}: ${message.text}`,
                ),
              );
            if (origin.reactions.length)
              sourceRecords.append(
                textElement(
                  "p",
                  "Reactions: " + JSON.stringify(origin.reactions),
                ),
              );
            if (origin.warnings.length)
              sourceRecords.append(
                textElement("p", origin.warnings.map(words).join(" · ")),
              );
          }
        }
        appendOrigins(item.origins);
        let nextOrigin = item.next_origin_offset;
        const moreOrigins = button("More source records", async () => {
          if (moreOrigins.disabled) return;
          moreOrigins.disabled = true;
          try {
            const page = await api(
              `/api/archive/${item.id}/origins?offset=${nextOrigin}`,
            );
            appendOrigins(page.items);
            nextOrigin = page.next_offset;
            moreOrigins.hidden = nextOrigin === null;
          } finally {
            moreOrigins.disabled = false;
          }
        });
        moreOrigins.hidden = nextOrigin === null;
        details.append(moreOrigins);
        article.append(details);
        $("gallery").append(article);
      }
      galleryOffset = offset + items.length;
      $("more").hidden = items.length < 30;
      if (!galleryOffset)
        $("gallery").append(
          el(
            "p",
            "fx-empty",
            "Successfully imported photos will appear here for everyone in your group.",
          ),
        );
    } finally {
      if (request === galleryRequest) galleryLoading = false;
    }
  }

  renderSourceCards();
  syncSource();
  root
    .querySelector("#upload select[name=source]")
    .addEventListener("change", syncSource);
  $("choose-again").onclick = () => {
    const file = root.querySelector("#upload input[name=file]");
    file.scrollIntoView({ block: "center" });
    file.focus();
  };
  $("how-to").onclick = () => {
    $("source-cards").scrollIntoView({ block: "start" });
    $("source-cards").querySelector("button")?.focus({ preventScroll: true });
  };
  $("upload").onsubmit = (event) => {
    event.preventDefault();
    run(async () => {
      const values = Object.fromEntries(new FormData(event.target));
      const uploadGroupId = group.id;
      if (values.file.size > 128 * 1024 * 1024)
        throw new Error("Archive must be 128 MiB or smaller.");
      $("upload-button").disabled = true;
      try {
        const sha256 = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              await values.file.arrayBuffer(),
            ),
          ),
        )
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
        const options = values.date_order
          ? { date_order: values.date_order }
          : {};
        const { id } = await api("/api/imports/start", {
          group: uploadGroupId,
          source: values.source,
          namespace: values.namespace,
          size: values.file.size,
          sha256,
          options,
        });
        selectedRun = id;
        reportOffset = 0;
        const uploadReport = await api(`/api/imports/${id}?offset=0`);
        await showReport(id, uploadReport);
        let received = uploadReport.received;
        if (uploadReport.state === "UPLOADING") {
          // Chunk progress lives in the transfer bar; the toast says it once.
          notice("Transferring archive…");
          while (received < values.file.size) {
            const bytes = new Uint8Array(
              await values.file
                .slice(received, received + 512 * 1024)
                .arrayBuffer(),
            );
            let binary = "";
            for (const byte of bytes) binary += String.fromCharCode(byte);
            received = (
              await api("/api/imports/chunk", {
                id,
                offset: received,
                data: btoa(binary),
              })
            ).received;
            $("transfer").value = Math.round(
              (received * 100) / values.file.size,
            );
          }
          await api("/api/imports/finish", { id });
          notice(
            "Transfer complete. Scanning the inventory; no photos have been ingested yet.",
          );
        } else
          notice(
            "Existing import found. Its progress and outcome report are preserved.",
          );
        await refreshImports();
        await refreshReport();
        $("report-title").focus();
      } finally {
        $("upload-button").disabled = false;
      }
    });
  };
  for (const action of ["confirm", "cancel", "withdraw"]) {
    $(action).onclick = () =>
      run(async () => {
        await api("/api/imports/" + action, { id: selectedRun });
        notice(
          {
            confirm:
              "Import started. Each successful photo becomes visible to your group.",
            cancel:
              "Remaining work cancelled. Successful photos remain shared.",
            withdraw: "This contribution has been withdrawn from group access.",
          }[action],
          "success",
        );
        await refreshReport();
        await refreshImports();
      });
  }
  $("previous").onclick = () =>
    run(async () => {
      reportOffset = Math.max(0, reportOffset - 100);
      await refreshReport();
    });
  $("next").onclick = () =>
    run(async () => {
      reportOffset = currentReport.next_offset;
      await refreshReport();
    });
  $("download").onclick = () =>
    run(async () => {
      const id = selectedRun;
      let report = await api(`/api/imports/${id}`);
      const result = { ...report, items: [...report.items] };
      while (report.next_offset !== null) {
        report = await api(`/api/imports/${id}?offset=${report.next_offset}`);
        result.items.push(...report.items);
      }
      result.next_offset = null;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(result, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "mazi-import-report.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  $("refresh-gallery").onclick = () => run(() => gallery());
  $("more").onclick = () => run(() => gallery(true));
  setInterval(async () => {
    if (
      polling ||
      !selectedRun ||
      document.hidden ||
      (currentReport?.id === selectedRun &&
        terminalStates.includes(currentReport.state))
    )
      return;
    polling = true;
    try {
      await refreshReport();
    } catch (error) {
      notice(error.message, "error");
    } finally {
      polling = false;
    }
  }, 1500);
  $("retry-workspace").onclick = () =>
    run(async () => {
      $("retry-workspace").disabled = true;
      try {
        await refresh();
        if ($("workspace-error").hidden) $("page-title").focus();
      } finally {
        $("retry-workspace").disabled = false;
      }
    });
  run(async () => {
    await refresh();
    if (
      !root.isConnected ||
      $("workspace").hidden ||
      lifecycle.mountKind === "refresh"
    )
      return;
    const target =
      circleMode &&
      new URLSearchParams(lifecycle.search).get("section") === "settings"
        ? $("group-settings-heading")
        : $("page-title");
    target.focus({ preventScroll: true });
    if (target.id === "group-settings-heading")
      target.scrollIntoView({ block: "start" });
  });
}
