// _wraplong.mjs - wrap lines over 100 columns: code at the last ", " that fits (continued two
// spaces deeper), comments at the last space (continued with the same comment prefix).
// node tools/scratch/_wraplong.mjs file ...
import fs from 'node:fs';
const MAX = 100;
for (const file of process.argv.slice(2)) {
  const out = [];
  let changed = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    let rest = line;
    while (rest.length > MAX) {
      const comment = rest.match(/^(\s*(?:\/\/|\*)\s?)/);
      const indent = rest.match(/^\s*/)[0];
      let cut, next;
      if (comment && !/^\s*\/\/.*[;{]\s*$/.test(rest) && rest.trimStart().match(/^(\/\/|\*)/)) {
        cut = rest.lastIndexOf(' ', MAX);
        if (cut <= comment[1].length) break;
        next = comment[1] + rest.slice(cut + 1);
        out.push(rest.slice(0, cut));
      } else {
        cut = rest.lastIndexOf(', ', MAX - 1);
        if (cut <= indent.length) break;
        out.push(rest.slice(0, cut + 1));
        next = indent + '  ' + rest.slice(cut + 2);
      }
      rest = next;
      changed++;
    }
    out.push(rest);
  }
  fs.writeFileSync(file, out.join('\n'));
  console.log(file, changed);
}
