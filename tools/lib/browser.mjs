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

/** Extra page-link settings from the RAC3R_QUERY environment variable ("skip=world,ground"), as "&..." or "". */
export function extraQuery() {
  const extra = (process.env.RAC3R_QUERY || "").replace(/^[?&]+/, "");
  return extra ? "&" + extra : "";
}

export function launchBrowser(options = {}) {
  return chromium.launch({ channel: process.env.CHECK_BROWSER ?? "msedge", ...options });
}

// ms between checks while waiting for the game. A timed poll, not Playwright's default
// animation-frame poll: the determinism script replaces requestAnimationFrame, and Edge 155
// never runs the default poll under it (measured: 8 s timeout vs ready in under 1 s).
const READY_POLL_MS = 50;
// ms to wait for the game before failing (a cold start under automation takes 1-3 s)
const READY_TIMEOUT_MS = 30000;

/**
 * Open the game and wait until it is running. index.html starts the game with a dynamic
 * import(), so the page's load event fires before window.__game exists: never read the game
 * after goto alone.
 * @param {import('playwright').Page} page the page
 * @param {string} url the full game link
 * @param {string} [ready] a page-side expression that must be truthy too, e.g. "window.__rt"
 * @returns {Promise<void>}
 */
export async function gotoGame(page, url, ready = "true") {
  await page.goto(url);
  await page.waitForFunction(`window.__game && (${ready})`, null, {
    polling: READY_POLL_MS,
    timeout: READY_TIMEOUT_MS,
  });
}
