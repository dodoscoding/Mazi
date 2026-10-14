export function createLifecycle(
  root: HTMLElement,
  search: string,
  restart: () => void,
) {
  let active = true;
  let controller = new AbortController();
  const urls = new Set<string>();
  const timers = new Set<number>();
  const intervals = new Set<number>();
  const cleanups: (() => void)[] = [];
  const initializedGroups = new WeakSet<HTMLSelectElement>();
  const groupId = sessionStorage.getItem("mazi.group") || "";
  const apiFetch: typeof fetch = async (input, init) => {
    if (!active) throw new DOMException("Feature disposed", "AbortError");
    const requestController = controller;
    let response = await window.fetch(input, {
      ...init,
      signal: requestController.signal,
      cache: "no-store",
    });
    if (!active || requestController.signal.aborted)
      throw new DOMException("Feature disposed", "AbortError");
    if (response.status === 401 || response.status === 403) {
      const errorBody = await response.text();
      response = new Response(errorBody, {
        status: response.status,
        headers: response.headers,
      });
      const auth = root.querySelector<HTMLElement>("#auth");
      const workspace = root.querySelector<HTMLElement>("#workspace");
      const signedOutForm = auth && workspace?.hidden;
      root
        .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          "input, textarea",
        )
        .forEach((field) => {
          if (signedOutForm && auth.contains(field)) return;
          field.value = "";
          if (field instanceof HTMLInputElement) field.checked = false;
        });
      if (!signedOutForm) root.hidden = true;
      controller.abort();
      controller = new AbortController();
      if (!signedOutForm) window.dispatchEvent(new Event("mazi:access-lost"));
    }
    const json = response.json.bind(response);
    const blob = response.blob.bind(response);
    response.json = async () => {
      const value = await json();
      if (!active || (response.ok && requestController.signal.aborted))
        throw new DOMException("Feature disposed", "AbortError");
      return value;
    };
    response.blob = async () => {
      const value = await blob();
      if (!active || requestController.signal.aborted)
        throw new DOMException("Feature disposed", "AbortError");
      return value;
    };
    return response;
  };
  class ScopedURL extends URL {
    static createObjectURL(blob: Blob) {
      if (!active) throw new DOMException("Feature disposed", "AbortError");
      const url = URL.createObjectURL(blob);
      urls.add(url);
      return url;
    }
    static revokeObjectURL(url: string) {
      urls.delete(url);
      URL.revokeObjectURL(url);
    }
  }
  return {
    groupId,
    search,
    fetch: apiFetch,
    URL: ScopedURL,
    selectGroup(select: HTMLSelectElement) {
      if (
        !initializedGroups.has(select) &&
        groupId &&
        Array.from(select.options).some((option) => option.value === groupId)
      )
        select.value = groupId;
      initializedGroups.add(select);
      return select.value;
    },
    sessionChanged() {
      sessionStorage.removeItem("mazi.group");
      window.dispatchEvent(new Event("mazi:session"));
      restart();
    },
    setInterval(callback: () => void, delay: number) {
      const timer = window.setInterval(() => {
        if (active) callback();
      }, delay);
      intervals.add(timer);
      return timer;
    },
    setTimeout(callback: () => void, delay: number) {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (active) callback();
      }, delay);
      timers.add(timer);
      return timer;
    },
    onDispose(callback: () => void) {
      cleanups.push(callback);
    },
    dispose() {
      active = false;
      controller.abort();
      intervals.forEach(window.clearInterval);
      timers.forEach(window.clearTimeout);
      urls.forEach(URL.revokeObjectURL);
      cleanups.forEach((callback) => callback());
      root
        .querySelectorAll("img")
        .forEach((image) => image.removeAttribute("src"));
      root.remove();
    },
  };
}
