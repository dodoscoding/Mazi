import type { Chapter, ChapterRequest } from "./model.ts";
export class ParallelError extends Error {
  code: string;
  constructor(message: string, code = "") {
    super(message);
    this.code = code;
  }
}
export async function parallelRequest(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
) {
  const timeout = AbortSignal.timeout(75000);
  const response = await fetch(`/api/parallel/${path}`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new Event("mazi:access-lost"));
    }
    throw new ParallelError(
      value.error || "Story unavailable. Please retry.",
      value.code || "",
    );
  }
  return value;
}
export async function chapter(
  request: ChapterRequest,
  signal: AbortSignal,
): Promise<Chapter> {
  const result = await parallelRequest("chapter", request, signal);
  return { ...result, meters: result.state };
}
