import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixtureDirectory = new URL("./fixtures/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("manifest.json", fixtureDirectory)),
);
const fixtures = manifest.files.map(({ name, mime, sha256 }) => {
  const bytes = readFileSync(new URL(name, fixtureDirectory));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256);
  return { name, mime, bytes };
});

function localProvider() {
  const config = readFileSync(
    new URL("../../supabase/config.toml", import.meta.url),
    "utf8",
  );
  assert.match(config, /^project_id = "mazi-m0-experiment"$/m);
  assert.equal(
    execFileSync("npx", ["supabase", "--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    }).trim(),
    "2.119.0",
  );
  let status;
  try {
    status = JSON.parse(
      execFileSync("npx", ["supabase", "status", "-o", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
      }),
    );
  } catch {
    assert.fail("Local Supabase status unavailable; start mazi-m0-experiment");
  }
  const url = new URL(status.API_URL);
  assert.equal(url.protocol, "http:");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.equal(url.port, "56321");
  assert.equal(url.pathname, "/");
  assert.ok(status.ANON_KEY && status.SERVICE_ROLE_KEY);
  return {
    url: url.origin,
    anonymousKey: status.ANON_KEY,
    setupKey: status.SERVICE_ROLE_KEY,
  };
}

test(
  "M0 real Auth, database and private Storage access boundaries",
  { timeout: 120_000 },
  async (t) => {
    const provider = localProvider();
    const users = [];
    const objects = [];
    const group = randomUUID();
    const otherGroup = randomUUID();
    const password = `Synthetic-M0-${randomUUID()}`;
    const actors = {};
    const contributions = [];

    async function request(
      path,
      { method = "GET", body, token, setup = false, headers = {} } = {},
    ) {
      const key = setup ? provider.setupKey : provider.anonymousKey;
      const response = await fetch(`${provider.url}${path}`, {
        method,
        headers: {
          apikey: key,
          ...(setup || token
            ? { Authorization: `Bearer ${setup ? provider.setupKey : token}` }
            : {}),
          ...(body && !Buffer.isBuffer(body)
            ? { "Content-Type": "application/json" }
            : {}),
          ...headers,
        },
        body: body
          ? Buffer.isBuffer(body)
            ? body
            : JSON.stringify(body)
          : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      const data =
        response.headers.get("content-type")?.includes("json") && bytes.length
          ? JSON.parse(bytes.toString())
          : undefined;
      return {
        status: response.status,
        bytes,
        data,
        contentRange: response.headers.get("content-range"),
      };
    }

    function succeeds(response) {
      assert.ok(
        response.status >= 200 && response.status < 300,
        `expected success, received HTTP ${response.status}`,
      );
    }

    function denied(response, forbiddenNames = []) {
      assert.ok(
        [400, 401, 403, 404].includes(response.status),
        `expected denial, received HTTP ${response.status}`,
      );
      for (const fixture of fixtures)
        assert.notDeepEqual(response.bytes, fixture.bytes);
      for (const name of forbiddenNames)
        assert.ok(
          !response.bytes.toString().includes(name),
          "denial leaked protected identity",
        );
    }

    function databaseWriteDenied(response) {
      assert.ok(
        [401, 403].includes(response.status),
        `expected database authorization denial, received HTTP ${response.status}`,
      );
    }

    async function insert(table, rows) {
      const response = await request(`/rest/v1/${table}`, {
        method: "POST",
        body: rows,
        setup: true,
      });
      succeeds(response);
    }

    async function patch(table, query, body) {
      const response = await request(`/rest/v1/${table}?${query}`, {
        method: "PATCH",
        body,
        setup: true,
      });
      succeeds(response);
    }

    async function archive(actor, expected) {
      const token = actor?.token;
      const rows = await request(
        `/rest/v1/contributions?group_id=eq.${group}&select=id,filename,media_type,object_key&order=id`,
        { token },
      );
      if (!actor) denied(rows);
      else {
        succeeds(rows);
        assert.deepEqual(
          rows.data,
          expected
            .map(({ id, filename, media_type, object_key }) => ({
              id,
              filename,
              media_type,
              object_key,
            }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        );
      }
      const count = await request(
        `/rest/v1/contributions?group_id=eq.${group}&select=id`,
        { token, headers: { Prefer: "count=exact" } },
      );
      if (!actor) denied(count);
      else {
        succeeds(count);
        assert.equal(count.data.length, expected.length);
        assert.equal(Number(count.contentRange.split("/")[1]), expected.length);
      }
      const listing = await request("/storage/v1/object/list/m0-originals", {
        method: "POST",
        body: { prefix: group, limit: 100 },
        token,
      });
      if (expected.length) succeeds(listing);
      if (listing.status === 200) {
        assert.deepEqual(
          listing.data.map((entry) => entry.name).sort(),
          expected.map((entry) => entry.id).sort(),
        );
      } else denied(listing);
      const rootListing = await request(
        "/storage/v1/object/list/m0-originals",
        {
          method: "POST",
          body: { prefix: "", limit: 100 },
          token,
        },
      );
      const visibleGroups =
        actor === actors.otherGroup
          ? [otherGroup]
          : expected.length
            ? [group]
            : [];
      if (visibleGroups.length) succeeds(rootListing);
      if (rootListing.status === 200)
        assert.deepEqual(
          rootListing.data.map(({ name }) => name).sort(),
          visibleGroups,
        );
      else denied(rootListing);
      for (const contribution of contributions.filter(
        ({ group_id }) => group_id === group,
      )) {
        const download = await request(
          `/storage/v1/object/authenticated/m0-originals/${contribution.object_key}`,
          { token },
        );
        if (expected.some(({ id }) => id === contribution.id)) {
          succeeds(download);
          assert.deepEqual(download.bytes, contribution.fixture.bytes);
        } else denied(download, [contribution.filename, contribution.id]);
      }
    }

    async function setupFixtures() {
      for (const name of [
        "alice",
        "ben",
        "admin",
        "outsider",
        "removed",
        "otherGroup",
      ]) {
        const email = `m0-${name.toLowerCase()}-${randomUUID()}@example.test`;
        const created = await request("/auth/v1/admin/users", {
          method: "POST",
          setup: true,
          body: { email, password, email_confirm: true },
        });
        succeeds(created);
        users.push(created.data.id);
        const signedIn = await request("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: { email, password },
        });
        succeeds(signedIn);
        assert.equal(signedIn.data.user.id, created.data.id);
        assert.ok(signedIn.data.access_token && signedIn.data.expires_in > 120);
        actors[name] = {
          id: created.data.id,
          token: signedIn.data.access_token,
        };
      }
      await insert("memberships", [
        ...["alice", "ben", "admin", "removed"].map((name) => ({
          group_id: group,
          user_id: actors[name].id,
          role: name === "admin" ? "admin" : "member",
          status: name === "removed" ? "removed" : "active",
        })),
        {
          group_id: otherGroup,
          user_id: actors.otherGroup.id,
          role: "member",
          status: "active",
        },
      ]);
      const bucket = await request("/storage/v1/bucket", {
        method: "POST",
        setup: true,
        body: {
          id: "m0-originals",
          name: "m0-originals",
          public: false,
          allowed_mime_types: ["image/jpeg", "image/png"],
          file_size_limit: 25 * 1024 * 1024,
        },
      });
      assert.ok([200, 201, 400, 409].includes(bucket.status));
      const bucketState = await request("/storage/v1/bucket/m0-originals", {
        setup: true,
      });
      succeeds(bucketState);
      assert.equal(bucketState.data.public, false);
      assert.deepEqual(bucketState.data.allowed_mime_types.sort(), [
        "image/jpeg",
        "image/png",
      ]);
      assert.equal(bucketState.data.file_size_limit, 25 * 1024 * 1024);
      for (const [name, state, owner, targetGroup, fixture] of [
        ["ready", "available", "alice", group, fixtures[0]],
        ["pending", "processing", "alice", group, fixtures[1]],
        ["withdrawn", "withdrawn", "alice", group, fixtures[1]],
        ["independent", "available", "admin", group, fixtures[1]],
        ["ben", "available", "ben", group, fixtures[1]],
        ["other", "available", "otherGroup", otherGroup, fixtures[0]],
      ]) {
        const id = randomUUID();
        const filename = `${name}-${id}.${fixture.mime === "image/jpeg" ? "jpg" : "png"}`;
        const object_key = `${targetGroup}/${id}/${filename}`;
        const contribution = {
          id,
          group_id: targetGroup,
          owner_id: actors[owner].id,
          state,
          filename,
          media_type: fixture.mime,
          object_key,
        };
        await insert("contributions", contribution);
        const upload = await request(
          `/storage/v1/object/m0-originals/${object_key}`,
          {
            method: "POST",
            setup: true,
            body: fixture.bytes,
            headers: { "Content-Type": fixture.mime },
          },
        );
        succeeds(upload);
        objects.push(object_key);
        contributions.push({ ...contribution, fixture, name });
      }
    }

    try {
      await setupFixtures();
      const ready = contributions.filter(
        ({ group_id, state }) => group_id === group && state === "available",
      );
      await t.test(
        "active contributor, second member and administrator read rows and real JPEG/PNG bytes",
        async () => {
          for (const actor of [actors.alice, actors.ben, actors.admin])
            await archive(actor, ready);
        },
      );
      await t.test(
        "outsider, removed member, other group and anonymous cannot read protected rows or bytes",
        async () => {
          for (const actor of [
            actors.outsider,
            actors.removed,
            actors.otherGroup,
            null,
          ])
            await archive(actor, []);
          const other = contributions.find(({ name }) => name === "other");
          denied(
            await request(
              `/storage/v1/object/authenticated/m0-originals/${other.object_key}`,
              { token: actors.alice.token },
            ),
            [other.filename, other.id],
          );
        },
      );
      await t.test(
        "one item becomes available while its withdrawn neighbor stays inaccessible",
        async () => {
          const pending = contributions.find(({ name }) => name === "pending");
          await patch("contributions", `id=eq.${pending.id}`, {
            state: "available",
          });
          pending.state = "available";
          ready.push(pending);
          await archive(actors.ben, ready);
        },
      );
      await t.test(
        "public object route cannot bypass the private bucket",
        async () => {
          for (const token of [undefined, actors.alice.token]) {
            const response = await request(
              `/storage/v1/object/public/m0-originals/${ready[0].object_key}`,
              { token },
            );
            denied(response, [ready[0].filename, ready[0].id]);
          }
          denied(
            await request(
              `/storage/v1/object/authenticated/m0-originals/${group}/${randomUUID()}/unknown.png`,
              { token: actors.alice.token },
            ),
          );
        },
      );
      await t.test(
        "user database writes are denied and leave privileged snapshots unchanged",
        async () => {
          const before = await request(
            `/rest/v1/contributions?group_id=eq.${group}&order=id`,
            { setup: true },
          );
          succeeds(before);
          const memberBefore = await request(
            `/rest/v1/memberships?group_id=eq.${group}&order=user_id`,
            { setup: true },
          );
          succeeds(memberBefore);
          for (const actor of [
            actors.alice,
            actors.admin,
            actors.otherGroup,
            null,
          ]) {
            databaseWriteDenied(
              await request("/rest/v1/contributions", {
                method: "POST",
                token: actor?.token,
                body: { ...before.data[0], id: randomUUID() },
              }),
            );
            databaseWriteDenied(
              await request(`/rest/v1/contributions?id=eq.${ready[0].id}`, {
                method: "PATCH",
                token: actor?.token,
                body: {
                  owner_id: actors.admin.id,
                  group_id: otherGroup,
                  state: "available",
                },
              }),
            );
            databaseWriteDenied(
              await request(`/rest/v1/memberships?group_id=eq.${group}`, {
                method: "PATCH",
                token: actor?.token,
                body: { status: "active", role: "admin" },
              }),
            );
          }
          const after = await request(
            `/rest/v1/contributions?group_id=eq.${group}&order=id`,
            { setup: true },
          );
          const memberAfter = await request(
            `/rest/v1/memberships?group_id=eq.${group}&order=user_id`,
            { setup: true },
          );
          succeeds(after);
          succeeds(memberAfter);
          assert.deepEqual(after.data, before.data);
          assert.deepEqual(memberAfter.data, memberBefore.data);
        },
      );
      await t.test(
        "user Storage upload, overwrite and deletion fail without altering bytes",
        async () => {
          const item = ready[0];
          for (const actor of [
            actors.alice,
            actors.admin,
            actors.otherGroup,
            null,
          ]) {
            for (const method of ["POST", "PUT"]) {
              denied(
                await request(
                  `/storage/v1/object/m0-originals/${item.object_key}`,
                  {
                    method,
                    token: actor?.token,
                    body: fixtures[1].bytes,
                    headers: {
                      "Content-Type": fixtures[1].mime,
                      "x-upsert": "true",
                    },
                  },
                ),
              );
            }
            denied(
              await request(
                `/storage/v1/object/m0-originals/${group}/${randomUUID()}/forbidden.png`,
                {
                  method: "POST",
                  token: actor?.token,
                  body: fixtures[1].bytes,
                  headers: { "Content-Type": fixtures[1].mime },
                },
              ),
            );
            const deletion = await request("/storage/v1/object/m0-originals", {
              method: "DELETE",
              token: actor?.token,
              body: { prefixes: [item.object_key] },
            });
            if (deletion.status === 200) assert.deepEqual(deletion.data, []);
            else denied(deletion);
            const download = await request(
              `/storage/v1/object/authenticated/m0-originals/${item.object_key}`,
              { token: actors.alice.token },
            );
            succeeds(download);
            assert.deepEqual(download.bytes, item.fixture.bytes);
          }
        },
      );
      await t.test(
        "membership revocation denies an existing JWT and contributor departure hides only dependent items",
        async () => {
          const originalToken = actors.ben.token;
          assert.ok(
            JSON.parse(Buffer.from(originalToken.split(".")[1], "base64url"))
              .exp >
              Date.now() / 1000,
          );
          await patch(
            "memberships",
            `group_id=eq.${group}&user_id=eq.${actors.ben.id}`,
            { status: "removed" },
          );
          assert.equal(actors.ben.token, originalToken);
          await archive(actors.ben, []);
          const remaining = ready.filter(
            ({ owner_id }) => owner_id !== actors.ben.id,
          );
          await archive(actors.alice, remaining);
          assert.ok(remaining.some(({ name }) => name === "independent"));
        },
      );
      await t.test(
        "withdrawal denies new reads with the same current reader JWT",
        async () => {
          const originalToken = actors.alice.token;
          assert.ok(
            JSON.parse(Buffer.from(originalToken.split(".")[1], "base64url"))
              .exp >
              Date.now() / 1000,
          );
          const item = ready[0];
          await patch("contributions", `id=eq.${item.id}`, {
            state: "withdrawn",
          });
          assert.equal(actors.alice.token, originalToken);
          await archive(
            actors.alice,
            ready.filter(
              ({ id, owner_id }) =>
                id !== item.id && owner_id !== actors.ben.id,
            ),
          );
        },
      );
    } finally {
      if (objects.length)
        succeeds(
          await request("/storage/v1/object/m0-originals", {
            method: "DELETE",
            setup: true,
            body: { prefixes: objects },
          }),
        );
      for (const id of users)
        succeeds(
          await request(`/auth/v1/admin/users/${id}`, {
            method: "DELETE",
            setup: true,
          }),
        );
    }
  },
);
