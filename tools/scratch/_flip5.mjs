import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
sub('src/physics/wheelspin.ts', `// skates on its own melt): a locked or spinning tyre's grip share falls by up to LOCK_FADE at LOCK_FADE_V of slide.`,
`// skates on its own melt): a locked or spinning tyre's grip share falls by up to LOCK_FADE at
// LOCK_FADE_V of slide.`);
sub('src/render/particles.ts', `// controlled by speed / tyre heat"; with real wheel speed it came out too constantly): each tyre's smoke strength is
// its heat share`, `// controlled by speed / tyre heat"; with real wheel speed it came out too constantly): each
// tyre's smoke strength is its heat share`);
