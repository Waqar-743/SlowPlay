export const WORLD_RADIUS = 112
// A conservative hull radius protects the pointed bow as well as the beam.
export const BOAT_RADIUS = 5.415
export const SECTOR_COUNT = 16
export const collisionRocks = [
  { x: -33, z: -10, radius: 2.5 }, { x: -30, z: -14, radius: 1.7 },
  { x: 30, z: 9, radius: 2.6 }, { x: 33, z: 12, radius: 1.6 },
  { x: 17, z: -23, radius: 2 }, { x: 20, z: -24, radius: 1.4 },
]

export function islandRadius(angle) {
  const ellipse = 1 / Math.sqrt((Math.cos(angle) / 32) ** 2 + (Math.sin(angle) / 24) ** 2)
  const cove = Math.exp(-((Math.atan2(Math.sin(angle - Math.PI / 2), Math.cos(angle - Math.PI / 2)) / 0.4) ** 2)) * 0.14
  return ellipse * (1 + 0.055 * Math.sin(3 * angle + 0.5) + 0.035 * Math.cos(5 * angle) - cove)
}

export function collidesWithLand(x, z, padding = BOAT_RADIUS) {
  const angle = Math.atan2(z, x)
  return Math.hypot(x, z) < islandRadius(angle) + padding
}

export function createBoatState() {
  return { x: 0, z: 42, heading: 0, speed: 0, distance: 0, sectors: [], contact: false, boundary: false }
}

export function stepBoat(state, input = {}, delta = 1 / 60) {
  const dt = Math.max(0, Math.min(delta, 0.05))
  const next = { ...state, sectors: [...state.sectors], contact: false, boundary: false }
  let speed = state.speed
  if (input.throttle) speed += 4.7 * dt
  if (input.brake) speed -= (speed > 0.15 ? 9 : 3.8) * dt
  if (!input.throttle && !input.brake) speed *= Math.exp(-0.42 * dt)
  speed = Math.max(-3.4, Math.min(10, speed))
  if (Math.abs(speed) < 0.018) speed = 0
  const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  next.heading += turn * (0.4 + Math.min(Math.abs(speed) / 8, 1) * 0.85) * dt * (speed < -0.2 ? -1 : 1)
  next.x += Math.sin(next.heading) * speed * dt
  next.z -= Math.cos(next.heading) * speed * dt

  if (collidesWithLand(next.x, next.z)) {
    const angle = Math.atan2(next.z, next.x)
    const safeRadius = islandRadius(angle) + BOAT_RADIUS + 0.04
    next.x = Math.cos(angle) * safeRadius
    next.z = Math.sin(angle) * safeRadius
    speed = Math.min(0, -Math.abs(speed) * 0.14)
    next.contact = true
  }
  for (const rock of collisionRocks) {
    const dx = next.x - rock.x
    const dz = next.z - rock.z
    const separation = Math.hypot(dx, dz)
    const safeDistance = rock.radius + BOAT_RADIUS
    if (separation < safeDistance) {
      const angle = separation > 0.001 ? Math.atan2(dz, dx) : 0
      next.x = rock.x + Math.cos(angle) * (safeDistance + 0.04)
      next.z = rock.z + Math.sin(angle) * (safeDistance + 0.04)
      speed = -Math.abs(speed) * 0.12
      next.contact = true
    }
  }
  // A rock can touch the beach. Resolve the union of both obstacles along an
  // outward ray so a rock correction can never push the hull back into land.
  if (collidesWithLand(next.x, next.z)) {
    const angle = Math.atan2(next.z, next.x)
    const ux = Math.cos(angle)
    const uz = Math.sin(angle)
    let safeRadius = islandRadius(angle) + BOAT_RADIUS + 0.04
    for (const rock of collisionRocks) {
      const projection = rock.x * ux + rock.z * uz
      const perpendicular = rock.x * uz - rock.z * ux
      const size = rock.radius + BOAT_RADIUS + 0.04
      if (Math.abs(perpendicular) < size) {
        const reach = Math.sqrt(size * size - perpendicular * perpendicular)
        if (safeRadius > projection - reach && safeRadius < projection + reach) safeRadius = projection + reach
      }
    }
    next.x = ux * safeRadius
    next.z = uz * safeRadius
    next.contact = true
  }
  const radius = Math.hypot(next.x, next.z)
  if (radius > WORLD_RADIUS) {
    const angle = Math.atan2(next.z, next.x)
    next.x = Math.cos(angle) * (WORLD_RADIUS - 0.5)
    next.z = Math.sin(angle) * (WORLD_RADIUS - 0.5)
    next.heading = Math.atan2(-next.x, next.z)
    speed = Math.min(Math.abs(speed), 3)
    next.boundary = true
  }
  const moved = Math.hypot(next.x - state.x, next.z - state.z)
  next.distance += moved
  next.speed = speed
  const coastAngle = Math.atan2(next.z, next.x)
  if (radius < islandRadius(coastAngle) + 23 + BOAT_RADIUS && moved > 0.003) {
    const sector = Math.floor(((coastAngle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * SECTOR_COUNT)
    if (!next.sectors.includes(sector)) next.sectors.push(sector)
  }
  return next
}
