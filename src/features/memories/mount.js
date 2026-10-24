import { createGallery } from "./gallery";
import "./memories.css";

export function mount(root, lifecycle) {
  const { fetch, setInterval, setTimeout, URL } = lifecycle;
  const $ = (id) => root.querySelector(`#${id}`);
  let group = "",
    generation = 0;
  function node(tag, text) {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
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
    if (!response.ok) {
      const error = Error(data.error || "Request failed");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  const mediaUrls = new Set();
  function clear() {
    for (const url of mediaUrls) URL.revokeObjectURL(url);
    mediaUrls.clear();
    $("capsules").replaceChildren();
    $("notifications").textContent = "";
    generation++;
    $("recap").replaceChildren();
    $("stories").replaceChildren();
    $("notice").textContent = "";
  }
  async function mutate(path, body) {
    const selected = group;
    clear();
    const current = generation;
    try {
      await api(path, { group: selected, ...body });
      if (current === generation) await refresh();
    } catch (error) {
      if (current === generation) $("notice").textContent = error.message;
    }
  }
  function eventTitle(title, id) {
    const heading = node("h3", "");
    const link = node("a", title);
    link.href = `#/memory/${encodeURIComponent(id)}?notebook=1`;
    heading.append(link);
    return heading;
  }
  function renderStory(story) {
    const panel = node("article", "");
    panel.className = "panel story";
    const header = node("header", "");
    header.className = "story-head";
    header.append(
      eventTitle(story.event.title, story.event.id),
      node("p", story.notice),
    );
    panel.append(header);
    const saved = node("section", "");
    saved.className = "story-saved";
    saved.append(node("h4", "Saved recollections"));
    const contributions = node("div", "");
    contributions.className = "story-recollections";
    contributions.setAttribute("role", "region");
    contributions.setAttribute("aria-label", "Saved recollections");
    function updateContributions() {
      contributions.replaceChildren(
        ...story.contributions.map((entry) =>
          node("p", (entry.editable ? "You: " : "Group member: ") + entry.text),
        ),
      );
    }
    updateContributions();
    saved.append(contributions);
    panel.append(saved);
    const writing = node("section", "");
    writing.className = "story-writing";
    writing.setAttribute("aria-label", "Your recollection");
    const form = node("form", ""),
      label = node("label", "Your recollection"),
      input = node("textarea", "");
    input.maxLength = 2000;
    input.value =
      story.contributions.find((entry) => entry.editable)?.text || "";
    label.append(input);
    form.className = "story-form";
    const save = node("button", "Save my recollection");
    save.className = "story-save";
    const remove = node("button", "Remove my recollection");
    remove.type = "button";
    remove.className = "story-remove";
    let saving = false;
    let conflicted = false;
    const refreshSaved = node("button", "Refresh saved story");
    refreshSaved.type = "button";
    refreshSaved.className = "story-recover";
    refreshSaved.hidden = true;
    refreshSaved.onclick = async () => {
      if (refreshSaved.disabled) return;
      refreshSaved.disabled = true;
      const current = generation;
      try {
        const stories = await api(
          "/api/memories/stories?" +
            new URLSearchParams({ group, year: $("year").value }),
        );
        if (current !== generation || !panel.isConnected) return;
        const updated = stories.find((item) => item.id === story.id);
        if (!updated) throw Error("This story is no longer available.");
        Object.assign(story, updated);
        updateContributions();
        conflicted = false;
        if (document.activeElement === refreshSaved)
          input.focus({ preventScroll: true });
        refreshSaved.hidden = true;
        save.disabled = remove.disabled = false;
        $("notice").textContent =
          "Saved recollections refreshed. Your draft is unchanged; review them before saving again.";
      } catch (error) {
        if (current === generation && panel.isConnected)
          $("notice").textContent = error.message + " Your draft is kept.";
      } finally {
        refreshSaved.disabled = false;
      }
    };
    async function writeRecollection(text) {
      if (saving || conflicted) return;
      saving = true;
      save.disabled = remove.disabled = true;
      const current = generation;
      const draft = input.value;
      $("notice").textContent = "";
      try {
        const updated = await api("/api/memories/write", {
          group,
          story: story.id,
          revision: story.revision,
          text,
        });
        if (current !== generation || !panel.isConnected) return;
        Object.assign(story, updated);
        updateContributions();
        if (input.value === draft)
          input.value =
            story.contributions.find((entry) => entry.editable)?.text || "";
        $("notice").textContent = "Recollection saved.";
      } catch (error) {
        if (current === generation && panel.isConnected) {
          conflicted = error.status === 409;
          refreshSaved.hidden = !conflicted;
          $("notice").textContent =
            error.message +
            (conflicted
              ? " Your draft is kept. Refresh the saved story before retrying."
              : " Your draft is kept. Try saving again.");
        }
      } finally {
        saving = false;
        save.disabled = remove.disabled = conflicted;
      }
    }
    form.append(label, save);
    form.onsubmit = (event) => {
      event.preventDefault();
      void writeRecollection(input.value);
    };
    writing.append(form);
    remove.onclick = () => void writeRecollection("");
    writing.append(remove, refreshSaved);
    panel.append(writing);
    const tools = node("section", "");
    tools.className = "story-tools";
    tools.setAttribute("aria-label", "Photos and exports");
    tools.append(node("h4", "Photos & exports"));
    const download = node("button", "Export story JSON");
    download.type = "button";
    download.onclick = async () => {
      const current = generation;
      try {
        const result = await api(
          "/api/memories/export?" +
            new URLSearchParams({ group, story: story.id }),
        );
        if (current !== generation) return;
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(result, null, 2)], {
            type: "application/json",
          }),
        );
        const link = node("a", "");
        link.href = url;
        link.download = "mazi-story.json";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        if (current === generation) {
          clear();
          $("notice").textContent = error.message;
        }
      }
    };
    tools.append(download);
    if (story.can_delete) {
      const button = node("button", "Delete story");
      button.type = "button";
      button.onclick = () =>
        mutate("/api/memories/delete", {
          story: story.id,
          revision: story.revision,
        });
      button.className = "story-delete";
      tools.append(button);
    }
    advancedStory(tools, story);
    panel.append(tools);
    return panel;
  }
  async function refresh() {
    clear();
    const current = generation;
    if (!group) return;
    try {
      const query = new URLSearchParams({ group, year: $("year").value });
      const [recap, stories] = await Promise.all([
        api("/api/memories/recap?" + query),
        api("/api/memories/stories?" + query),
      ]);
      if (current !== generation) return;
      $("recap").append(
        node("h2", `${recap.year} · Annual recap`),
        node("p", recap.coverage),
      );
      if (!recap.memories.length)
        $("recap").append(
          node("p", "No eligible approved memories for this year."),
        );
      for (const memory of recap.memories) {
        const card = node("article", "");
        card.className = "panel";
        card.append(
          eventTitle(memory.title, memory.id),
          node("p", `${memory.start} — ${memory.end}`),
        );
        for (const asset of memory.assets)
          card.append(node("p", asset.title || "Untitled photograph"));
        const button = node("button", "Start a story");
        button.onclick = () =>
          mutate("/api/memories/create", { event: memory.id });
        card.append(button);
        $("recap").append(card);
      }
      if (!stories.length)
        $("stories").append(node("p", "No shared stories yet."));
      for (const story of stories) $("stories").append(renderStory(story));
      await renderCapsules(current);
    } catch (error) {
      if (current === generation) $("notice").textContent = error.message;
    }
  }
  $("year-form").onsubmit = (event) => {
    event.preventDefault();
    refresh();
  };
  $("refresh").onclick = refresh;
  const grid = createGallery(root, lifecycle, api);
  $("groups").onchange = () => {
    group = lifecycle.selectGroup($("groups"));
    grid.load(group);
    refresh();
  };
  void (async () => {
    await Promise.resolve();
    try {
      for (const g of await api("/api/groups")) {
        const option = node("option", g.name);
        option.value = g.id;
        $("groups").append(option);
      }
      group = lifecycle.selectGroup($("groups"));
      $("groups").closest("label").hidden = $("groups").options.length < 2;
      grid.load(group);
      await refresh();
    } catch (error) {
      $("notice").textContent = error.message + ". Sign in from Imports.";
    }
  })();

  const capsuleForm = $("capsule-form");
  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob),
      link = node("a", "");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function binary(path, body) {
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
    if (!response.ok) {
      const error = await response.json();
      throw Error(error.error || "Unavailable");
    }
    return response.blob();
  }
  function advancedStory(panel, story) {
    const gallery = node("div", ""),
      image = node("img", ""),
      caption = node("p", "");
    gallery.className = "story-gallery";
    image.alt = "Photograph from this approved memory";
    image.hidden = true;
    image.style.maxWidth = "100%";
    let position = 0,
      imageUrl = null,
      requestId = 0;
    const assets = story.subevents.flatMap((section) => section.assets);
    assets.push(
      ...story.event.assets.filter((asset) => !assets.includes(asset)),
    );
    const show = async (delta) => {
      const current = generation,
        request = ++requestId;
      position = (position + delta + assets.length) % assets.length;
      image.hidden = true;
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        mediaUrls.delete(imageUrl);
      }
      try {
        const blob = await binary(
          "/api/memories/frame?" +
            new URLSearchParams({
              group,
              story: story.id,
              asset: assets[position],
            }),
        );
        if (current !== generation || request !== requestId) return;
        imageUrl = URL.createObjectURL(blob);
        mediaUrls.add(imageUrl);
        image.src = imageUrl;
        image.hidden = false;
        caption.textContent = `Photo ${position + 1} of ${assets.length}`;
      } catch (error) {
        if (current === generation) {
          clear();
          $("notice").textContent = error.message;
        }
      }
    };
    for (const [name, delta] of [
      ["Show slideshow", 0],
      ["Previous photo", -1],
      ["Next photo", 1],
    ]) {
      const button = node("button", name);
      button.type = "button";
      button.onclick = () => show(delta);
      gallery.append(button);
    }
    gallery.append(image, caption);
    panel.append(gallery);
    const video = node("button", "Download video (AVI)");
    video.type = "button";
    video.onclick = async () => {
      const current = generation;
      video.disabled = true;
      try {
        const blob = await binary("/api/memories/video", {
          group,
          story: story.id,
        });
        if (current === generation) saveBlob(blob, "mazi-memory.avi");
      } catch (error) {
        if (current === generation) {
          clear();
          $("notice").textContent = error.message;
        }
      } finally {
        video.disabled = false;
      }
    };
    panel.append(
      video,
      node(
        "p",
        "Silent photo montage · 640 × 480 · 3 seconds per photo · up to 20 photos. Local generation; downloaded copies cannot be recalled.",
      ),
    );
    const heading = node("h4", "Sub-events");
    panel.append(heading);
    for (const section of story.subevents)
      panel.append(
        node("p", `${section.title} · ${section.assets.length} photos`),
      );
    const form = node("form", ""),
      label = node("label", "Sub-event title"),
      title = node("input", "");
    form.className = "story-subevents";
    title.required = true;
    title.maxLength = 200;
    label.append(title);
    form.append(label);
    const choices = node("fieldset", "");
    choices.append(node("legend", "Photos for this sub-event"));
    const used = new Set(story.subevents.flatMap((section) => section.assets));
    const inputs = [];
    story.event.assets.forEach((asset, index) => {
      if (used.has(asset)) return;
      const label = node("label", `Photo ${index + 1}`),
        input = node("input", "");
      label.className = "check";
      input.type = "checkbox";
      input.value = asset;
      label.prepend(input);
      choices.append(label);
      inputs.push(input);
    });
    form.append(choices, node("button", "Add sub-event"));
    form.onsubmit = (event) => {
      event.preventDefault();
      mutate("/api/memories/subevents", {
        story: story.id,
        revision: story.revision,
        sections: [
          ...story.subevents,
          {
            title: title.value,
            assets: inputs.filter((i) => i.checked).map((i) => i.value),
          },
        ],
      });
    };
    panel.append(form);
    const reset = node("button", "Clear sub-events");
    reset.type = "button";
    reset.onclick = () =>
      mutate("/api/memories/subevents", {
        story: story.id,
        revision: story.revision,
        sections: [],
      });
    panel.append(reset);
  }
  async function renderCapsules(current) {
    const selected = group;
    const query = new URLSearchParams({ group: selected });
    const [capsules, notices] = await Promise.all([
      api("/api/memories/capsules?" + query),
      api("/api/memories/notifications?" + query),
    ]);
    if (current !== generation) return;
    $("notifications-enabled").checked = notices.enabled;
    $("notifications").textContent = notices.items.length
      ? `${notices.items.length} time capsule(s) ready to open.`
      : "";
    if (!capsules.length)
      $("capsules").append(node("p", "No available capsules."));
    for (const capsule of capsules) {
      const card = node("article", "");
      card.className = "panel";
      card.append(
        node("h3", capsule.locked ? "Sealed capsule" : "Ready to open"),
        node("p", new Date(capsule.unlock_at * 1000).toLocaleString()),
      );
      if (!capsule.locked) {
        const open = node("button", "Open capsule");
        open.type = "button";
        open.onclick = async () => {
          const current = generation;
          try {
            const result = await api(
              "/api/memories/capsule?" +
                new URLSearchParams({ group: selected, capsule: capsule.id }),
            );
            if (current !== generation) return;
            const content = node("div", "");
            content.append(node("h4", result.title), node("p", result.text));
            if (result.has_photo) {
              const blob = await binary(
                "/api/memories/capsule-photo?" +
                  new URLSearchParams({ group: selected, capsule: capsule.id }),
              );
              if (current !== generation) return;
              const image = node("img", ""),
                url = URL.createObjectURL(blob);
              mediaUrls.add(url);
              image.src = url;
              image.alt = "Photograph inside the opened capsule";
              image.style.maxWidth = "100%";
              content.append(image);
            }
            open.replaceWith(content);
          } catch (error) {
            if (current === generation) {
              clear();
              $("notice").textContent = error.message;
            }
          }
        };
        card.append(open);
        const download = node("button", "Export capsule");
        download.type = "button";
        download.onclick = async () => {
          const current = generation;
          try {
            const result = await api(
              "/api/memories/capsule-export?" +
                new URLSearchParams({ group: selected, capsule: capsule.id }),
            );
            if (current === generation)
              saveBlob(
                new Blob([JSON.stringify(result, null, 2)], {
                  type: "application/json",
                }),
                "mazi-capsule.json",
              );
          } catch (error) {
            if (current === generation) {
              clear();
              $("notice").textContent = error.message;
            }
          }
        };
        card.append(download);
      }
      if (capsule.can_delete) {
        const remove = node("button", "Delete capsule");
        remove.type = "button";
        remove.onclick = () =>
          mutate("/api/memories/delete-capsule", { capsule: capsule.id });
        card.append(remove);
      }
      $("capsules").append(card);
    }
  }
  capsuleForm.onsubmit = async (event) => {
    event.preventDefault();
    const selected = group,
      current = generation;
    try {
      const file = $("capsule-photo").files[0];
      let photo = "";
      if (file) {
        if (file.size > 2 * 1024 * 1024) throw Error("Photo limit is 2 MiB");
        photo = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = () => reject(Error("Cannot read photo"));
          reader.readAsDataURL(file);
        });
      }
      if (current !== generation) return;
      const body = {
        group: selected,
        title: $("capsule-title").value,
        text: $("capsule-text").value,
        unlock_at: new Date($("capsule-date").value).toISOString(),
        photo,
      };
      await api("/api/memories/seal", body);
      if (current !== generation) return;
      capsuleForm.reset();
      await refresh();
      $("notice").textContent =
        "Capsule sealed. Content cannot be read or edited before opening time.";
    } catch (error) {
      if (current === generation) $("notice").textContent = error.message;
    }
  };
  $("notifications-enabled").onchange = () =>
    mutate("/api/memories/notifications", {
      enabled: $("notifications-enabled").checked,
    });
}
