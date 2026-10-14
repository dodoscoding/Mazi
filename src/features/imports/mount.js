export function mount(root, lifecycle) {
  const { fetch, setInterval, setTimeout, URL } = lifecycle;
  const $ = (id) => root.querySelector(`#${id}`);
  let group = null;
  let selectedRun = null;
  let reportOffset = 0;
  let galleryOffset = 0;
  let polling = false;
  let currentReport = null;
  let gallerySignature = "";

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
    return data;
  }
  function notice(message) {
    $("notice").textContent = message;
  }
  async function run(action) {
    try {
      await action();
    } catch (error) {
      notice(error.message);
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
  function button(label, action) {
    const element = textElement("button", label);
    element.type = "button";
    element.addEventListener("click", () => run(action));
    return element;
  }

  async function refresh() {
    let groups;
    try {
      groups = await api("/api/groups");
    } catch {
      $("auth").hidden = false;
      $("workspace").hidden = true;
      $("logout").hidden = true;
      return;
    }
    $("auth").hidden = true;
    $("workspace").hidden = false;
    $("logout").hidden = false;
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

  async function selectGroup() {
    selectedRun = null;
    currentReport = null;
    gallerySignature = "";
    $("report").hidden = true;
    $("group-work").hidden = !group;
    $("invite").hidden = group?.role !== "admin";
    $("invitation").textContent = "";
    $("members").replaceChildren();
    if (!group) return;
    const members = await api("/api/members?group=" + group.id);
    for (const member of members) {
      const row = textElement("p", member.email + " · " + member.role + " ");
      if (group.role === "admin" && member.role !== "admin") {
        row.append(
          button("Remove member", async () => {
            await api("/api/member/remove", {
              group: group.id,
              user: member.id,
            });
            notice("Membership and that member’s contributions withdrawn.");
            await selectGroup();
          }),
        );
      }
      $("members").append(row);
    }
    await refreshImports();
    await gallery();
  }

  async function refreshImports() {
    if (!group) return;
    const imports = await api("/api/imports?group=" + group.id);
    $("imports").replaceChildren();
    for (const item of imports) {
      $("imports").append(
        button(
          `${words(item.source)} · ${words(item.state)} · ${new Date(item.created_at * 1000).toLocaleString()}`,
          async () => {
            selectedRun = item.id;
            reportOffset = 0;
            await refreshReport();
            $("report-title").focus();
          },
        ),
      );
    }
    if (!imports.length)
      $("imports").textContent = "Your import reports will appear here.";
  }

  async function refreshReport() {
    if (!selectedRun) return;
    const id = selectedRun;
    const report = await api(`/api/imports/${id}?offset=${reportOffset}`);
    if (selectedRun !== id) return;
    currentReport = report;
    $("report").hidden = false;
    $("report-title").textContent =
      `${words(report.source)} · ${words(report.state)}`;
    const summary = `${report.discovered} discovered · ${Object.entries(
      report.counts,
    )
      .map(([key, count]) => `${count} ${words(key)}`)
      .join(
        " · ",
      )} · ${report.unique_assets} unique photos${report.withdrawn ? " · Contribution withdrawn" : ""}${report.error ? " · " + words(report.error) : ""}`;
    if ($("report-summary").textContent !== summary)
      $("report-summary").textContent = summary;
    $("coverage").textContent = report.coverage;
    $("confirm").hidden = report.state !== "INVENTORIED";
    $("cancel").hidden = ["COMPLETED", "CANCELLED", "FAILED"].includes(
      report.state,
    );
    $("withdraw").hidden =
      report.withdrawn || !report.counts.AVAILABLE_TO_GROUP;
    $("transfer").value = Math.round((report.received * 100) / report.size);
    const tableSignature = JSON.stringify(report.items);
    if ($("items").dataset.signature !== tableSignature) {
      $("items").dataset.signature = tableSignature;
      $("items").replaceChildren();
      for (const item of report.items) {
        const row = document.createElement("tr");
        row.append(
          textElement("td", item.filename || item.locator),
          textElement("td", words(item.outcome)),
        );
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
    if (!group) return;
    if (!more) {
      galleryOffset = 0;
      $("gallery").replaceChildren();
    }
    const items = await api(
      `/api/archive?group=${group.id}&offset=${galleryOffset}`,
    );
    for (const item of items) {
      const article = document.createElement("article");
      const image = document.createElement("img");
      image.src = `/api/archive/${item.id}/preview`;
      image.alt = item.origins[0]?.original_filename || "Imported photograph";
      image.loading = "lazy";
      article.append(image);
      const download = textElement("a", "Download original");
      download.href = `/api/archive/${item.id}/original`;
      download.download = item.origins[0]?.original_filename || "original";
      article.append(download);
      const details = document.createElement("details");
      details.append(
        textElement(
          "summary",
          `${item.origin_count} source record${item.origin_count === 1 ? "" : "s"} · dates and conversation`,
        ),
      );
      const sourceRecords = document.createElement("div");
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
        const page = await api(
          `/api/archive/${item.id}/origins?offset=${nextOrigin}`,
        );
        appendOrigins(page.items);
        nextOrigin = page.next_offset;
        moreOrigins.hidden = nextOrigin === null;
      });
      moreOrigins.hidden = nextOrigin === null;
      details.append(moreOrigins);
      article.append(details);
      $("gallery").append(article);
    }
    galleryOffset += items.length;
    $("more").hidden = items.length < 30;
    if (!galleryOffset)
      $("gallery").append(
        textElement(
          "p",
          "Successfully imported photos will appear here for everyone in your group.",
        ),
      );
  }

  $("register").onsubmit = (event) => {
    event.preventDefault();
    run(async () => {
      await api(
        "/api/register",
        Object.fromEntries(new FormData(event.target)),
      );
      notice("Account created. Sign in to continue.");
      event.target.reset();
    });
  };
  $("login").onsubmit = (event) => {
    event.preventDefault();
    run(async () => {
      await api("/api/login", Object.fromEntries(new FormData(event.target)));
      window.dispatchEvent(new Event("mazi:session"));
      event.target.reset();
      await refresh();
      notice("Signed in.");
    });
  };
  $("logout").onclick = () =>
    run(async () => {
      await api("/api/logout", {});
      lifecycle.sessionChanged();
    });
  $("create-group").onsubmit = (event) => {
    event.preventDefault();
    run(async () => {
      await api("/api/group", Object.fromEntries(new FormData(event.target)));
      event.target.reset();
      await refresh();
    });
  };
  $("join").onsubmit = (event) => {
    event.preventDefault();
    run(async () => {
      await api("/api/accept", Object.fromEntries(new FormData(event.target)));
      event.target.reset();
      await refresh();
    });
  };
  $("invite").onclick = () =>
    run(async () => {
      const result = await api("/api/invite", { group: group.id });
      $("invitation").textContent =
        "Share privately. Expires in 24 hours: " + result.token;
    });
  $("upload").onsubmit = (event) => {
    event.preventDefault();
    run(async () => {
      const values = Object.fromEntries(new FormData(event.target));
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
          group: group.id,
          source: values.source,
          namespace: values.namespace,
          size: values.file.size,
          sha256,
          options,
        });
        selectedRun = id;
        reportOffset = 0;
        await refreshReport();
        let received = currentReport.received;
        if (currentReport.state === "UPLOADING") {
          while (received < values.file.size) {
            const bytes = new Uint8Array(
              await values.file
                .slice(received, received + 256 * 1024)
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
            notice(`Transferring archive · ${$("transfer").value}%`);
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
    if (polling || !selectedRun || document.hidden) return;
    polling = true;
    try {
      await refreshReport();
    } catch (error) {
      notice(error.message);
    } finally {
      polling = false;
    }
  }, 1500);
  run(refresh);
}
