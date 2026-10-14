// Uses the existing page's live group/revision controls; never stores private content.
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
  image.alt = "Photograph from this approved memory";
  image.hidden = true;
  image.style.maxWidth = "100%";
  let position = 0,
    imageUrl = null,
    requestId = 0;
  const assets = story.subevents.flatMap((section) => section.assets);
  assets.push(...story.event.assets.filter((asset) => !assets.includes(asset)));
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
