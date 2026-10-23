import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { deferred } from "./feature-harness.mjs";

async function owner(t, fetch) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.window = { fetch };
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  const { createDiscordReturn } = await vite.ssrLoadModule(
    "/src/features/discordReturn.ts",
  );
  t.after(async () => {
    await vite.close();
    if (saved) Object.defineProperty(globalThis, "window", saved);
    else delete globalThis.window;
  });
  return createDiscordReturn("?code=synthetic-code&state=synthetic-state");
}

test("replacement views await one Discord exchange", async (t) => {
  const response = deferred();
  const requests = [];
  const returned = await owner(t, (path, init) => {
    requests.push({ path, body: JSON.parse(init.body) });
    return response.promise;
  });
  returned.bind("member");
  const first = returned.finish();
  const replacement = returned.finish();
  response.resolve(Response.json({ guild: { id: "77", name: "Lake house" } }));
  assert.deepEqual(await first, { guild: { id: "77", name: "Lake house" } });
  assert.deepEqual(await replacement, await first);
  assert.deepEqual(requests, [
    {
      path: "/api/sources/discord/link",
      body: { code: "synthetic-code", state: "synthetic-state" },
    },
  ]);
});

for (const change of ["clear", "account"]) {
  test(`${change} invalidates an in-flight Discord result`, async (t) => {
    const response = deferred();
    let signal;
    let requests = 0;
    const returned = await owner(t, (_, init) => {
      requests++;
      signal = init.signal;
      return response.promise;
    });
    returned.bind("first-member");
    const result = returned.finish();
    if (change === "clear") returned.clear();
    else returned.bind("different-member");
    response.resolve(
      Response.json({ guild: { id: "77", name: "Lake house" } }),
    );
    await assert.rejects(result, { name: "AbortError" });
    await assert.rejects(returned.finish(), { name: "AbortError" });
    assert.equal(requests, 1);
    assert.equal(signal.aborted, true);
    assert.equal(returned.params.toString(), "");
  });
}
