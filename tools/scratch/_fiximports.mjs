// _fiximports.mjs - set a file's `import type { ... } from '<from>'` to exactly the names it uses
// out of a candidate list, placed after the last import STATEMENT (multi-line ones included).
// node tools/scratch/_fiximports.mjs <from> <A,B,C> file ...
import fs from 'node:fs';
const [from, list, ...files] = process.argv.slice(2);
const names = list.split(',');
const esc = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(new RegExp(`import type \\{[^}]*\\} from '${esc(from)}';\\n?`), '');
  const used = names.filter((name) => new RegExp(`\\b${name}\\b`).test(s));
  if (used.length) {
    const lines = s.split('\n');
    let last = -1;
    for (let i = 0; i < lines.length; i++) {
      if (!/^import /.test(lines[i])) continue;
      let end = i;
      while (end < lines.length - 1 && !/from ['"][^'"]+['"];?\s*$/.test(lines[end])
        && !/^import ['"]/.test(lines[end])) end++;
      last = end;
      i = end;
    }
    lines.splice(last + 1, 0, `import type { ${used.join(', ')} } from '${from}';`);
    s = lines.join('\n');
  }
  fs.writeFileSync(file, s);
  console.log(file, used.join(' '));
}
