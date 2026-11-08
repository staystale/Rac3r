// reflow the // comment block containing line N of a file to 100 cols
import fs from 'node:fs';
const [file, lineNo] = [process.argv[2], +process.argv[3]];
const lines = fs.readFileSync(file, 'utf8').split('\n');
let a = lineNo - 1, b = lineNo - 1;
while (a > 0 && /^\s*\/\/ /.test(lines[a - 1])) a--;
while (b < lines.length - 1 && /^\s*\/\/ /.test(lines[b + 1])) b++;
const indent = lines[a].match(/^\s*/)[0];
const words = lines.slice(a, b + 1).map((l) => l.replace(/^\s*\/\/ ?/, '')).join(' ').split(/\s+/).filter(Boolean);
const out = []; let cur = indent + '//';
for (const w of words) { if ((cur + ' ' + w).length > 100) { out.push(cur); cur = indent + '//'; } cur += ' ' + w; }
out.push(cur);
lines.splice(a, b - a + 1, ...out);
fs.writeFileSync(file, lines.join('\n'));
