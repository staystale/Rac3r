// paths.mjs — shared paths for the tools: the repo root, found from this file, never a user folder.
import { fileURLToPath } from "node:url";

/** The repo root with a trailing slash, e.g. for repoRoot + "shots/". */
export const repoRoot = fileURLToPath(new URL("../../", import.meta.url)).replace(/\\/g, "/");
