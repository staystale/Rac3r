// _trafficseat.mjs - tools/trafficcheck.mjs with ?trafficseat=1 on (a woken traffic car seated
// on the ground): node tools/scratch/_trafficseat.mjs
import { setTrafficSeat } from '../../src/ai/trafficPhys.ts';
setTrafficSeat(true);
await import('../trafficcheck.mjs');
