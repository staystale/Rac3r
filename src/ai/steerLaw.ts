// ai/steerLaw.ts - ONE STEERING LAW for every AI driver (the AI rework R8 stage 2, one AI; owner
// 11-04: "why can't we have the circuit steering on the highway? circuits were working great").
// The circuit driver's Stanley controller: the heading error to the line a little ahead, the front
// axle's cross-track error, and damping of the steering's own yaw; and its cap, the kinematic
// angle of the grip-limited turn plus a front slip allowance. MEASURED 11-04 on the highway (it had
// its own law, with course aim, feed-forward, lateral and road-yaw damping, a heading cap and a
// counter-steer): weavecheck clean at 3 difficulties either way; races (pacesuite, 9) mean 131.2 ->
// 133.8 km/h, racer contact 99 -> 0, off-road 663 -> 0. (Making the circuit take the highway's law
// instead cost circuit fields 28-68 % more incidents.)

/**
 * The steering demand, rad at the wheels.
 * @param psi the heading error to the line a little ahead, rad
 * @param cross the front axle's cross-track error to the target, m
 * @param speed m/s
 * @param yawRate the car's yaw rate, rad/s
 * @param delta the front wheels' angle now, rad
 * @param wheelbase m
 * @returns rad
 */
export function steerDemand(psi: number, cross: number, speed: number, yawRate: number,
  delta: number, wheelbase: number): number {
  return psi + Math.atan2(-1.2 * cross, speed + 2)
    - 0.03 * (yawRate - speed * Math.tan(delta) / wheelbase);
}

/**
 * The steering's cap, a share of the lock: the kinematic angle for the grip-limited turn + a
 * front slip allowance (the bench cap pinned at ~0.1 at 35 m/s: ran wide).
 * @param wheelbase m
 * @param grip the grip here (surface mu x the car's)
 * @param speed m/s
 * @param lock the car's full lock, rad
 * @returns 0..1
 */
export function steerCap(wheelbase: number, grip: number, speed: number, lock: number): number {
  return Math.min(1, (1.3 * wheelbase * grip * 9.81 / Math.max(4, speed * speed) + 0.12) / lock);
}
