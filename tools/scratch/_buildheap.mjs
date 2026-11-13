// _buildheap.mjs - A LEVEL BUILD'S HEAP (scratch): one level built cold in this process, the JS heap
// peak during it (from the collector's own trace: the most in use before any collection) and what
// is still held after it once collected (the level, and anything a builder kept). Set switches by
// env (FASTBUILD=1); the young space kept small, so the peak is what is live, not the collector's
// slack. node --expose-gc --trace-gc --max-semi-space-size=1 tools/scratch/_buildheap.mjs <level>
// | node tools/scratch/_buildheap.mjs --read   (prints one line: peak MB, after MB)
import * as readline from 'node:readline';

if (process.argv[2] === '--read') {
  // the trace's "Mark-Compact 123.4 (130.0) -> 98.7 (131.0) MB" lines: the first number is the
  // heap in use
  let peak = 0, after = null, level = '';
  for await (const text of readline.createInterface({ input: process.stdin })) {
    const used = text.match(/(?:Scavenge|Mark-Compact|Mark-sweep)[^0-9]*([0-9.]+) \(/);
    if (used) peak = Math.max(peak, +used[1]);
    const done = text.match(/^BUILT (\S+) after ([0-9.]+) MB/);
    if (done) [level, after] = [done[1], +done[2]];
  }
  console.log(`${level}: peak ${peak.toFixed(1)} MB in use, after the build ${after} MB`);
} else {
  const levelId = process.argv[2] || 'sillystone';
  const L = await import('../../src/lab.ts');
  L.setLevel(levelId);
  globalThis.gc();
  process.stdout.write(`\nBUILT ${levelId} after ${(process.memoryUsage().heapUsed / 1048576).toFixed(1)} MB\n`);
}
