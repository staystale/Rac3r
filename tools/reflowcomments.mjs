// reflowcomments.mjs - reflow comment paragraphs that were chopped in the middle.
//
// WHY: the phase 7 rename batches re-wrapped long comments line by line, so many comments now
// read "long line / short fragment / long line" - a sentence cut in the middle - instead of a
// reflowed paragraph. This tool joins each such paragraph and wraps it again at 100 characters.
// Code is never touched: only runs of full-line "//" comments with the same indent are looked at
// (a trailing comment after code is left alone).
//
//   node tools/reflowcomments.mjs <file...>           rewrite the files
//   node tools/reflowcomments.mjs <file...> --check   print the ragged count per file, exit 1 if any
//
// Paragraphs break at: an empty "//" line, a list marker line (-, *, "1." "1)" "a)"), a heading
// (ALL CAPS up to a colon), and any literal line (2+ spaces of extra indent, or 3+ spaces between
// words: tables, code, aligned blocks - kept exactly). A paragraph that already fits the width and
// has no short line (< 45) in its middle is left as it is.
import { readFileSync, writeFileSync } from "node:fs";

const WIDTH = 100;
const LONG = 85;
const SHORT = 45;

const args = process.argv.slice(2);
const check = args.includes("--check");
const files = args.filter((a) => !a.startsWith("--"));

const LIST = /^(?:[-*]\s|\d+[.)]\s|[A-Za-z]\)\s)/;
const HEADING = /^[A-Z][A-Z0-9 _\/&'-]*:(?:\s|$)/;

function classify(body) {
  if (body === null) return "literal";
  if (body.trim() === "") return "blank";
  if (/^\s{2,}/.test(body)) return "literal";
  if (/\S\s{3,}\S/.test(body)) return "literal";
  if (/^[@#]|^(?:eslint|prettier|istanbul|c8)\b/.test(body)) return "literal";
  if (LIST.test(body)) return "start";
  if (HEADING.test(body)) return "start";
  return "text";
}

function wrap(prefix, words) {
  const out = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") cur = w;
    else if (prefix.length + cur.length + 1 + w.length <= WIDTH) cur += " " + w;
    else {
      out.push(prefix + cur);
      cur = w;
    }
  }
  if (cur !== "") out.push(prefix + cur);
  return out;
}

function ragged(lines) {
  let n = 0;
  for (let i = 0; i + 2 < lines.length; i++) {
    if (lines[i].length > LONG && lines[i + 1].length < SHORT && lines[i + 2].length > LONG) n++;
  }
  return n;
}

// Returns the list of runs as { start, end } (end exclusive) of consecutive same-indent comments.
function findRuns(lines) {
  const runs = [];
  let i = 0;
  while (i < lines.length) {
    const m = /^(\s*)\/\//.exec(lines[i]);
    if (!m) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < lines.length) {
      const m2 = /^(\s*)\/\//.exec(lines[j]);
      if (!m2 || m2[1] !== m[1]) break;
      j++;
    }
    runs.push({ start: i, end: j, indent: m[1] });
    i = j;
  }
  return runs;
}

function reflowRun(runLines, indent) {
  const prefix = indent + "// ";
  const items = runLines.map((line) => {
    const rest = line.slice(indent.length + 2);
    let body = null;
    if (rest === "" || rest.trim() === "") body = "";
    else if (rest[0] === " ") body = rest.slice(1);
    return { line, body, kind: classify(body) };
  });
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length === 0) return;
    const lines = para.map((p) => p.line);
    const fits = lines.every((l) => l.length <= WIDTH);
    let midShort = false;
    for (let k = 0; k + 1 < lines.length; k++) if (lines[k].length < SHORT) midShort = true;
    if (fits && !midShort) out.push(...lines);
    else {
      const words = para.flatMap((p) => p.body.split(/\s+/).filter(Boolean));
      out.push(...wrap(prefix, words));
    }
    para = [];
  };
  for (const it of items) {
    if (it.kind === "blank" || it.kind === "literal") {
      flush();
      out.push(it.line);
    } else if (it.kind === "start") {
      flush();
      para.push(it);
    } else para.push(it);
  }
  flush();
  return out;
}

let total = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const runs = findRuns(lines);
  if (check) {
    let n = 0;
    for (const r of runs) n += ragged(lines.slice(r.start, r.end));
    if (n > 0) console.log(`${file}: ${n} ragged`);
    total += n;
    continue;
  }
  const out = [];
  let pos = 0;
  for (const r of runs) {
    out.push(...lines.slice(pos, r.start));
    out.push(...reflowRun(lines.slice(r.start, r.end), r.indent));
    pos = r.end;
  }
  out.push(...lines.slice(pos));
  const next = out.join("\n");
  if (next !== text) {
    writeFileSync(file, next);
    console.log(`reflowed ${file}`);
  }
}
if (check) {
  console.log(`total ragged: ${total}`);
  if (total > 0) process.exit(1);
}
