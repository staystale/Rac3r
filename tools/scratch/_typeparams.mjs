// _typeparams.mjs - add parameter types by name to every `function f(...)` signature of the given
// files (from a JSON map name -> type), and strip the {types} out of their JSDoc.
// node tools/scratch/_typeparams.mjs map.json file.ts ...
import fs from 'node:fs';
const [mapFile, ...files] = process.argv.slice(2);
const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  const missing = new Set();
  s = s.replace(/(function\s+\w+\s*\()([^)]*)(\))/g, (m, head, params, tail) => {
    if (!params.trim()) return m;
    const out = params.split(',').map((raw) => {
      if (raw.includes(':')) return raw;
      const match = raw.match(/^(\s*)(\w+)(\s*=\s*[\s\S]*)?(\s*)$/);
      if (!match) return raw;
      const [, lead, name, def = '', trail] = match;
      const type = map[name];
      if (!type) { missing.add(name); return raw; }
      return `${lead}${name}: ${type}${def}${trail}`;
    });
    return head + out.join(',') + tail;
  });
  s = s.replace(/ \* @param \{[^}]*\} (\[?)(\w+)\]?/g, (m, opt, name) => ` * @param ${name}`)
    .replace(/ \* @returns \{[^}]*\} /g, ' * @returns ');
  fs.writeFileSync(file, s);
  console.log(file, missing.size ? 'untyped: ' + [...missing].join(' ') : 'ok');
}
