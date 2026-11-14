export function createDiscordReturn(search: string) {
  const params = new URLSearchParams(search);
  const controller = new AbortController();
  let user = "";
  let exchange: Promise<{ guild: { id: string; name: string } }> | undefined;
  const clear = () => {
    for (const key of [...params.keys()]) params.delete(key);
    controller.abort();
  };
  return {
    params,
    bind(userId: string) {
      if (user && user !== userId) clear();
      user = userId;
    },
    finish() {
      if (controller.signal.aborted)
        return Promise.reject(
          new DOMException("Discord return cleared", "AbortError"),
        );
      exchange ??= window
        .fetch("/api/sources/discord/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: params.get("code"),
            state: params.get("state"),
          }),
          signal: controller.signal,
          cache: "no-store",
        })
        .then(async (response) => {
          const value = await response.json();
          if (controller.signal.aborted)
            throw new DOMException("Discord return cleared", "AbortError");
          if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
              clear();
              window.dispatchEvent(new Event("mazi:access-lost"));
            }
            throw Object.assign(new Error(value.error || "Request failed"), {
              status: response.status,
              code: value.code,
            });
          }
          return value;
        });
      return exchange;
    },
    clear,
  };
}
export type DiscordReturn = ReturnType<typeof createDiscordReturn>;
