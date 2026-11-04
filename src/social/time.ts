export function wallTime(local: string, zone: string) {
  if (!local || !zone) return { kind: "empty", offsets: [] as string[] };
  try {
    const epoch = Date.parse(local + "Z");
    if (!Number.isFinite(epoch))
      return { kind: "invalid", offsets: [] as string[] };
    const calendar = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const offsetFormat = new Intl.DateTimeFormat("en", {
      timeZone: zone,
      timeZoneName: "longOffset",
    });
    const candidates = new Set<string>();
    for (let hours = -36; hours <= 36; hours += 12) {
      const label = offsetFormat
        .formatToParts(epoch + hours * 3600000)
        .find((part) => part.type === "timeZoneName")!.value;
      candidates.add(label === "GMT" ? "+00:00" : label.replace("GMT", ""));
    }
    const offsets = [...candidates]
      .filter((offset) => {
        const sign = offset[0] === "-" ? -1 : 1;
        const [hours, minutes] = offset.slice(1).split(":").map(Number);
        const parts = Object.fromEntries(
          calendar
            .formatToParts(epoch - sign * (hours * 60 + minutes) * 60000)
            .map((part) => [part.type, part.value]),
        );
        return (
          `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` ===
          local.slice(0, 16)
        );
      })
      .sort();
    return { kind: offsets.length ? "valid" : "gap", offsets };
  } catch {
    return { kind: "invalid", offsets: [] as string[] };
  }
}

export function planDate(plan: { starts_at: string; timezone: string }) {
  return new Intl.DateTimeFormat("tr", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: plan.timezone,
  }).format(new Date(plan.starts_at));
}
