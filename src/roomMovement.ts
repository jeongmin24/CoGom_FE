export type GroundPosition = readonly [number, number];

const bounds = { minX: -5, maxX: 5, minZ: -3, maxZ: 3.5 };
const tableCenters = [-3, 0, 3];
const tableZ = 1;
const tableRadius = 1.05;
const counterLeft = 1.85;
const counterFront = -2.05;
const clearance = 0.000001;
const maxStepLength = 0.05;

function clampToRoom([x, z]: GroundPosition): [number, number] {
  return [Math.max(bounds.minX, Math.min(bounds.maxX, x)), Math.max(bounds.minZ, Math.min(bounds.maxZ, z))];
}

function separateObstacles(position: GroundPosition, previous?: GroundPosition): [number, number] {
  let [x, z] = position;
  for (const tableX of tableCenters) {
    const offsetX = x - tableX;
    const offsetZ = z - tableZ;
    const distance = Math.hypot(offsetX, offsetZ);
    if (distance >= tableRadius) continue;

    // Project onto the edge to keep tangential movement, including at occupied seats.
    const directionX = distance > 0 ? offsetX / distance : 0;
    const directionZ = distance > 0 ? offsetZ / distance : -1;
    x = tableX + directionX * (tableRadius + clearance);
    z = tableZ + directionZ * (tableRadius + clearance);
  }

  if (x > counterLeft && z < counterFront) {
    const cameFromLeft = previous !== undefined && previous[0] <= counterLeft;
    const cameFromFront = previous !== undefined && previous[1] >= counterFront;
    if (cameFromLeft && !cameFromFront) x = counterLeft;
    else if (cameFromFront && !cameFromLeft) z = counterFront;
    else if (x - counterLeft < counterFront - z) x = counterLeft;
    else z = counterFront;
  }
  return [x, z];
}

/** Resolve a frame's X/Z displacement while sliding along the room's furniture. */
export function resolveRoomMovement(current: GroundPosition, delta: GroundPosition): [number, number] {
  if (![...current, ...delta].every(Number.isFinite)) return [current[0], current[1]];

  // Seats may start slightly inside a tabletop's collision radius. Recover first
  // so short key presses can leave the seat instead of being rejected forever.
  let position = separateObstacles(clampToRoom(current));
  const boundedDestination = clampToRoom([position[0] + delta[0], position[1] + delta[1]]);
  const dx = boundedDestination[0] - position[0];
  const dz = boundedDestination[1] - position[1];
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / maxStepLength));

  // Small steps prevent crossing an entire desk after a slow frame or a large input.
  for (let step = 0; step < steps; step += 1) {
    const candidate = clampToRoom([position[0] + dx / steps, position[1] + dz / steps]);
    position = separateObstacles(candidate, position);
  }
  return position;
}
