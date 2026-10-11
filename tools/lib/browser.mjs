// browser.mjs — shared helpers for the browser check tools: start the static server, launch the browser.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../", import.meta.url));

async function answers(url) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

export async function startServer() {
  const port = process.env.CHECK_PORT || "8090";
  const url = `http://localhost:${port}`;
  const child = spawn(process.execPath, ["serve.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: port },
    stdio: "ignore",
  });
  const stop = () => {
    if (child.exitCode === null && !child.killed) child.kill();
  };
  const t0 = Date.now();
  while (!(await answers(url + "/"))) {
    if (Date.now() - t0 > 10000 || child.exitCode !== null) {
      stop();
      throw new Error(`server did not answer on ${url} within 10 s`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { url, stop };
}

export function launchBrowser() {
  return chromium.launch({ channel: process.env.CHECK_BROWSER ?? "msedge" });
}
