// EVENT LIGHTING (?eventlights=1; owner's picks 10-25, TODO F): knocked lights settle (recover or
// die), backlit boards, marshal post beacons, the start gantry's light bar and glowing start
// lights, multi-coloured festoon lights on grandstands, light spilling from caravans, floodlights
// on tyre rings at the busy corners, and street lights where generated stages pass buildings.
// Every light goes through the one night layer (render/light.ts) and world/lamps.ts.

let isOn = false;

/**
 * Turns the event lighting on or off (?eventlights=1).
 * @param isWanted true for event lighting
 */
export function setEventLights(isWanted: boolean): void {
  isOn = isWanted;
}

/**
 * Whether the event lighting is on.
 * @returns true when on
 */
export function eventLightsOn(): boolean {
  return isOn;
}
