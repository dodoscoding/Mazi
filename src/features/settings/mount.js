import { confirmAction, el } from "../ui.js";

export function mount(root, lifecycle) {
  const $ = (id) => root.querySelector(`#${id}`);
  let group;
  let exporting;
  let busy = false;
  const notice = (message) => {
    $("settings-notice").textContent = message;
  };
  async function api(path, body) {
    const response = await lifecycle.fetch(
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
  async function run(work) {
    if (busy) return;
    busy = true;
    const disable = (value) =>
      root
        .querySelectorAll("button:not(#settings-cancel-export), input, select")
        .forEach((control) => (control.disabled = value));
    disable(true);
    try {
      await work();
    } catch (error) {
      if (error.name !== "AbortError") notice(error.message);
    } finally {
      busy = false;
      disable(false);
    }
  }
  function action(label, work) {
    const button = el("button", "fx-button fx-button--quiet", label);
    button.type = "button";
    button.onclick = () => run(work);
    return button;
  }
  async function mutate(path, body) {
    try {
      await api(`/api/discovery/${path}`, body);
      await refresh();
      notice("Preference saved.");
    } catch (error) {
      await refresh();
      throw error;
    }
  }
  function options(id, rows) {
    $(id).replaceChildren(
      ...rows.map((item) => {
        const option = el("option", "", item.name);
        option.value = item.id;
        return option;
      }),
    );
  }
  async function preferences(state) {
    $("settings-personal-processing").checked =
      state.settings.contribution_enabled;
    $("settings-group-processing").checked = state.settings.group_enabled;
    const admin = group.role === "admin";
    $("settings-group-control").hidden = !admin;
    $("settings-admin").hidden = !admin;
    const visibility = $("settings-visibility");
    visibility.replaceChildren();
    for (const [items, label, path, body] of [
      [
        state.memories,
        "Hide memory",
        "hide-memory",
        (item) => ({ group: group.id, event: item.id, enabled: true }),
      ],
      [
        state.hidden_memories,
        "Restore memory",
        "hide-memory",
        (item) => ({ group: group.id, event: item.id, enabled: false }),
      ],
      [
        state.hidden,
        "Restore hidden photograph",
        "hide",
        (item) => ({ asset: item.id, enabled: false }),
      ],
      [
        state.suppressed,
        "Restore my association",
        "restore",
        (item) => ({ person: item.person, asset: item.asset }),
      ],
    ])
      for (const item of items)
        visibility.append(
          action(`${label}: ${item.title || item.name || "Untitled"}`, () =>
            mutate(path, body(item)),
          ),
        );
    if (!visibility.children.length)
      visibility.append(
        el("p", "fx-small", "No visibility choices to review."),
      );
    $("settings-identities").replaceChildren(
      ...state.identities.map((item) =>
        action(`Confirm I am ${item.name}`, () =>
          mutate("identity/confirm", { person: item.id }),
        ),
      ),
    );
    if (admin) {
      const [members, atlas] = await Promise.all([
        api(`/api/members?group=${encodeURIComponent(group.id)}`),
        api(`/api/atlas?group=${encodeURIComponent(group.id)}`),
      ]);
      options(
        "settings-account",
        members.map((item) => ({
          id: item.id,
          name: item.display_name || item.email,
        })),
      );
      const people = state.people.filter((item) => !item.verified);
      options("settings-person", people);
      options("settings-nonmember", people);
      const photos = atlas.memories.flatMap((memory) => memory.photos || []);
      options(
        "settings-asset",
        photos.map((photo) => ({
          id: photo.assetId,
          name: photo.caption || photo.assetId,
        })),
      );
    }
  }
  async function refresh() {
    $("settings-work").hidden = true;
    $("settings-retry").hidden = true;
    try {
      const groups = await api("/api/groups");
      group = groups.find((item) => item.id === lifecycle.groupId) || groups[0];
      if (!group) {
        notice("No circle is currently available.");
        return;
      }
      const [items, state] = await Promise.all([
        api(
          `/api/review/my-contributions?group=${encodeURIComponent(group.id)}`,
        ),
        api(`/api/discovery/state?group=${encodeURIComponent(group.id)}`),
      ]);
      await preferences(state);
      $("settings-mine").replaceChildren();
      if (!items.length)
        $("settings-mine").append(
          el(
            "p",
            "fx-small",
            "You have no active source records in this group.",
          ),
        );
      for (const item of items) {
        const card = el("article", "fx-panel");
        card.append(
          el("h4", "", item.filename),
          action("Remove my source record", async () => {
            const sure = await confirmAction(root, {
              title: "Stop sharing this source record?",
              body: `${item.filename} stops being shared with the circle at once. Copies other members imported themselves stay. Files already downloaded cannot be recalled.`,
              confirm: "Remove source record",
              cancel: "Keep sharing",
              danger: true,
            });
            if (!sure) return;
            await api("/api/review/delete-contribution", { origin: item.id });
            window.dispatchEvent(new Event("mazi:archive-changed"));
            await refresh();
            notice("Your source record is no longer shared.");
          }),
        );
        $("settings-mine").append(card);
      }
      $("settings-leave").hidden = group.role !== "member";
      $("settings-work").hidden = false;
      notice("");
    } catch (error) {
      $("settings-retry").hidden = false;
      throw error;
    }
  }
  $("settings-retry").onclick = () => run(refresh);
  $("settings-export").onclick = () =>
    run(async () => {
      if (!group || exporting) return;
      exporting = new AbortController();
      $("settings-export").disabled = true;
      $("settings-cancel-export").hidden = false;
      notice("Preparing your archive…");
      try {
        const response = await lifecycle.fetch(
          `/api/review/export?group=${encodeURIComponent(group.id)}`,
          { signal: exporting.signal },
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Export failed. Please retry.");
        }
        const blob = await response.blob();
        const url = lifecycle.URL.createObjectURL(blob);
        const link = el("a");
        link.href = url;
        link.download = "mazi-archive.zip";
        link.click();
        lifecycle.setTimeout(() => lifecycle.URL.revokeObjectURL(url), 1000);
        notice("Archive download started.");
      } catch (error) {
        if (error.name === "AbortError")
          notice("Export cancelled. You can try again.");
        else throw error;
      } finally {
        exporting = null;
        $("settings-export").disabled = false;
        $("settings-cancel-export").hidden = true;
      }
    });
  $("settings-cancel-export").onclick = () => exporting?.abort();
  lifecycle.onDispose(() => exporting?.abort());
  for (const [id, groupWide] of [
    ["settings-personal-processing", false],
    ["settings-group-processing", true],
  ])
    $(id).onchange = () =>
      run(() =>
        mutate("processing", {
          group: group.id,
          enabled: $(id).checked,
          group_wide: groupWide,
        }),
      );
  $("settings-identity-form").onsubmit = (event) => {
    event.preventDefault();
    run(() =>
      mutate("identity/propose", {
        person: $("settings-person").value,
        account: $("settings-account").value,
      }),
    );
  };
  $("settings-nonmember-form").onsubmit = (event) => {
    event.preventDefault();
    run(() =>
      mutate("nonmember-review", {
        person: $("settings-nonmember").value,
        asset: $("settings-asset").value,
        verified: $("settings-verified").checked,
        restore: $("settings-removal-action").value === "restore",
      }),
    );
  };
  $("settings-leave").onclick = () =>
    run(async () => {
      const sure = await confirmAction(root, {
        title: "Leave this circle?",
        body: "The atlas closes for you at once and your contributions stop being shared. Take a copy first if you want one.",
        confirm: "Leave and withdraw",
        cancel: "Stay",
        danger: true,
      });
      if (!sure) return;
      await api("/api/review/leave-group", { group: group.id });
      window.dispatchEvent(new Event("mazi:session"));
    });
  run(refresh);
}
