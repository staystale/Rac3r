// cpuprof.mjs - READS A NODE .cpuprofile (node --cpu-prof): self time and total time per function,
// the top N of each, so a slow build (tools/loadtime.mjs) shows where its time goes.
// node tools/cpuprof.mjs <file.cpuprofile> [top 25] [path filter, e.g. src/]
import fs from 'node:fs';

const [file, topArg = '25', filter = ''] = process.argv.slice(2);
const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(profile.nodes.map((node) => [node.id, node]));
const selfUs = new Map();
const gaps = profile.timeDeltas;
profile.samples.forEach((id, i) => selfUs.set(id, (selfUs.get(id) || 0) + (gaps[i] || 0)));
const parentOf = new Map();
for (const node of profile.nodes) for (const child of node.children || []) parentOf.set(child, node.id);
const nameOf = (node) => {
  const frame = node.callFrame;
  const where = frame.url.replace(/^.*\/(src|tools)\//, '$1/');
  return `${frame.functionName || '(anon)'} ${where}:${frame.lineNumber + 1}`;
};
const self = new Map(), total = new Map();
for (const [id, micros] of selfUs) {
  const node = byId.get(id);
  self.set(nameOf(node), (self.get(nameOf(node)) || 0) + micros);
  // every function on the stack once (recursion counted once)
  const seen = new Set();
  for (let at = id; at != null; at = parentOf.get(at)) {
    const name = nameOf(byId.get(at));
    if (seen.has(name)) continue;
    seen.add(name);
    total.set(name, (total.get(name) || 0) + micros);
  }
}
const show = (title, table) => {
  console.log(`== ${title}`);
  [...table].filter(([name]) => name.includes(filter)).sort((first, second) => second[1] - first[1])
    .slice(0, +topArg).forEach(([name, micros]) => console.log(
      `${(micros / 1000).toFixed(0).padStart(7)} ms  ${name}`));
};
show('self', self);
show('total', total);
