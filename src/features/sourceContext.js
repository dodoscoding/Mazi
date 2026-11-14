import { sourceLabel } from "../browse/model";

/** Recorded source strings only; safe to retain when AI answer presentation retires. */
export function sourceContext(value) {
  const body = document.createElement("div");
  const line = (tag, text) => {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  };
  body.append(
    line("h2", value.conversation),
    line("p", `${sourceLabel(value.source)} · Kaynak konuşma`),
    line("p", value.sourceRef),
    line(
      "p",
      "Aktarılmış kaynak mesajları. Bu bağlam tam konuşma dökümü değildir; tarihler mesajların paylaşım kaydıdır.",
    ),
  );
  const messages = document.createElement("ol");
  for (const message of value.messages) {
    const item = document.createElement("li");
    item.append(
      line("strong", message.sender?.label || "Kaynak katılımcısı"),
      line("time", String(message.shared_at || "Paylaşım tarihi bilinmiyor")),
      line("p", message.text),
    );
    messages.append(item);
  }
  body.append(messages);
  return body;
}
