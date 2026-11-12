// loadtime.mjs - HOW LONG A LEVEL TAKES TO BUILD, cold, headless: the JS a level load runs before
// the first frame (tracing the circuit, the venue, scenery, lanes, barriers, the AI's line), each
// level in its own node process (a player's first load: nothing cached). The browser's own share
// (ground tiles, sprites painted, images decoded) is not in it - tools/framecheck.mjs sees that.
// node tools/loadtime.mjs [level ...]   (no level: every registered level, slowest first)
// node tools/loadtime.mjs --one <level>  (the child: prints one JSON line)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);

/**
 * Times one level's build in this process: the module imports (shared by every level) apart from
 * setLevel itself, and setLevel's own time.
 * @param levelId the level
 */
async function timeOne(levelId) {
  const importStart = performance.now();
  const lab = await import('../src/lab.ts');
  const importMs = performance.now() - importStart;
  const buildStart = performance.now(), cpuStart = process.cpuUsage();
  lab.setLevel(levelId);
  const buildMs = performance.now() - buildStart;
  const cpu = process.cpuUsage(cpuStart), cpuMs = (cpu.user + cpu.system) / 1000;
  const level = lab.LEVEL;
  const counts = {
    props: level.props?.length || 0, barriers: level.barriers?.length || 0,
    lanes: level.lanes?.length || 0, cones: level.cones?.length || 0,
  };
  console.log(JSON.stringify({ levelId, importMs: +importMs.toFixed(0),
    buildMs: +buildMs.toFixed(0), cpuMs: +cpuMs.toFixed(0), ...counts }));
}

/**
 * Every level's time, each in a child process, slowest build first.
 * @param ids the levels (empty: all registered)
 */
async function timeAll(ids) {
  const lab = await import('../src/lab.ts');
  const list = ids.length ? ids : lab.LEVELS.map((level) => level.id);
  const self = fileURLToPath(import.meta.url);
  const rows = [];
  for (const levelId of list) {
    try {
      const out = execFileSync(process.execPath, [self, '--one', levelId],
        { encoding: 'utf8', timeout: 120000 });
      rows.push(JSON.parse(out.trim().split('\n').pop()));
    } catch (error) {
      rows.push({ levelId, error: String(error.message).split('\n')[0] });
    }
  }
  rows.sort((first, second) => (second.buildMs || 0) - (first.buildMs || 0));
  for (const row of rows) {
    if (row.error) { console.log(`${row.levelId.padEnd(28)} ERROR ${row.error}`); continue; }
    console.log(`${row.levelId.padEnd(28)} build ${String(row.buildMs).padStart(6)} ms`
      + `   cpu ${String(row.cpuMs).padStart(6)} ms   import ${String(row.importMs).padStart(5)} ms   props ${row.props}`
      + ` barriers ${row.barriers} lanes ${row.lanes} cones ${row.cones}`);
  }
}

if (args[0] === '--one') await timeOne(args[1]);
else await timeAll(args);
