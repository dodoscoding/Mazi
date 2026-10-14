import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:net";

const built = process.argv.includes("--built");
const python =
  process.env.MAZI_PYTHON ||
  (existsSync(".venv/bin/python") ? resolve(".venv/bin/python") : "python3");
const check = spawnSync(python, ["-c", "import PIL"], { stdio: "ignore" });
if (check.status !== 0) {
  console.error("Install the Python dependency first: npm run setup");
  process.exit(1);
}
const port = Number(process.env.MAZI_IMPORT_PORT || (built ? "5173" : "8005"));
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("Invalid MAZI_IMPORT_PORT");
await new Promise((resolvePort, reject) => {
  const probe = createServer();
  probe.once("error", () =>
    reject(
      Error(
        `Port ${port} is already in use. Stop that server or set MAZI_IMPORT_PORT.`,
      ),
    ),
  );
  probe.listen(port, "127.0.0.1", () => probe.close(resolvePort));
});
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGINT");
  const timer = setTimeout(() => {
    for (const child of children)
      if (child.exitCode === null) child.kill("SIGTERM");
  }, 4000);
  timer.unref();
  process.exitCode = code;
}
function launch(command, args, env) {
  const child = spawn(command, args, { stdio: "inherit", env });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
  return child;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
launch(python, ["-m", "mazi"], {
  ...process.env,
  MAZI_IMPORT_PORT: String(port),
});
if (!built) {
  let ready = false;
  for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* The backend has not bound its socket yet. */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  if (!ready) {
    console.error("The archive server did not start. See its error above.");
    stop(1);
  } else {
    launch(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
      {
        ...process.env,
        MAZI_API_PORT: String(port),
      },
    );
  }
}
