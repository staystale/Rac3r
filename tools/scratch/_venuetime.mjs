const t0 = performance.now();
const venue = await import('file:///C:/Users/Admin/Desktop/G/rac3r-wt/src/world/venue.ts');
const spec = await import('file:///C:/Users/Admin/Desktop/G/rac3r-wt/src/world/levels/brands-venue.ts');
console.log('import incl. both builds', (performance.now() - t0).toFixed(0), 'ms');
for (let i = 0; i < 2; i++) {
  const t1 = performance.now();
  venue.venueLevel(spec.BRANDS_SPEC, 'gp', 'x', 'x');
  console.log('one more GP build', (performance.now() - t1).toFixed(0), 'ms');
}
