import fs from 'node:fs';
const V = 'src/vehicle.ts';
let s = fs.readFileSync(V, 'utf8');
const doc = `/**
 * Yaw section of step: aerodynamic directional stability, the tyre and ploughing yaw moment, and
 * the one-sided yaw damping. Updates car.yawRate.
 */
`;
if (!s.includes(doc + '/**\n * The yaw moment of the flat')) throw new Error('x');
s = s.replace(doc + '/**\n * The yaw moment of the flat', '/**\n * The yaw moment of the flat');
s = s.replace('}\n\nfunction integrateYaw(', '}\n\n' + doc + 'function integrateYaw(');
fs.writeFileSync(V, s);
