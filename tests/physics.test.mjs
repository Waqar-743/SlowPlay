import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BOAT_RADIUS,
  WORLD_RADIUS,
  SECTOR_COUNT,
  collisionRocks,
  collidesWithLand,
  createBoatState,
  islandRadius,
  stepBoat,
} from '../src/games/island-drift/physics.js'

const advance = (state, input, frames) => {
  for (let frame = 0; frame < frames; frame += 1) state = stepBoat(state, input)
  return state
}
const rockContact = (state, margin = 0) => collisionRocks.some((rock) =>
  Math.hypot(state.x - rock.x, state.z - rock.z) < rock.radius + BOAT_RADIUS - margin)
const navigable = (state) => !collidesWithLand(state.x, state.z) && !rockContact(state, 0.001)

test('spawn is navigable; acceleration, drag, brake and reverse produce controlled motion', () => {
  const spawn = createBoatState()
  assert.ok(navigable(spawn))
  const moving = advance(spawn, { throttle: true }, 60)
  assert.ok(moving.speed > 4 && moving.speed < 5)
  assert.ok(moving.z < spawn.z)
  const coasting = advance(moving, {}, 60)
  assert.ok(coasting.speed > 0 && coasting.speed < moving.speed)
  const braking = advance(moving, { brake: true }, 30)
  assert.ok(Math.abs(braking.speed) < moving.speed)
  const reversing = advance(spawn, { brake: true }, 120)
  assert.ok(reversing.speed < 0)
  assert.ok(reversing.z > spawn.z)
  assert.ok(moving.distance > 0)
  assert.equal(spawn.distance, 0, 'stepping must not mutate previous state')
})

test('simultaneous throttle/steering turns the boat and reverse steering remains predictable', () => {
  const right = advance(createBoatState(), { throttle: true, right: true }, 60)
  const left = advance(createBoatState(), { throttle: true, left: true }, 60)
  assert.ok(right.heading > 0 && right.speed > 0 && right.x > 0)
  assert.ok(left.heading < 0 && left.speed > 0 && left.x < 0)
  const reverse = advance(createBoatState(), { brake: true, right: true }, 90)
  assert.ok(reverse.heading < 0 && reverse.speed < 0)
})

test('shoreline stops forward travel and reverse recovers into open water', () => {
  let state = createBoatState()
  let hit = false
  for (let frame = 0; frame < 600; frame += 1) {
    state = stepBoat(state, { throttle: true })
    assert.ok(!collidesWithLand(state.x, state.z), `shoreline penetration at frame ${frame}`)
    hit ||= state.contact
  }
  assert.ok(hit, 'forward sailing should meet the southern shore')
  const distanceAtShore = Math.hypot(state.x, state.z)
  state = advance(state, { brake: true }, 180)
  assert.ok(navigable(state))
  assert.ok(Math.hypot(state.x, state.z) > distanceAtShore + 4)
})

test('coastline and adjacent rock resolution never pushes a valid boat into terrain', () => {
  const regressions = [7, 8, 9].map((direction) => ({ x: -27, z: -13.5, heading: direction * Math.PI / 8 }))
  for (const location of regressions) {
    const state = { ...createBoatState(), ...location, speed: 10 }
    if (!navigable(state)) continue
    const next = stepBoat(state, { throttle: true }, 0.05)
    assert.ok(navigable(next), `overlapping shoreline/rock response from ${JSON.stringify(location)}`)
  }
  for (const rock of collisionRocks) {
    for (let direction = 0; direction < 32; direction += 1) {
      const angle = direction * Math.PI / 16
      const distance = rock.radius + BOAT_RADIUS + 0.15
      const x = rock.x + Math.cos(angle) * distance
      const z = rock.z + Math.sin(angle) * distance
      const state = { ...createBoatState(), x, z, heading: Math.atan2(-Math.cos(angle), Math.sin(angle)), speed: 10 }
      if (!navigable(state)) continue
      const next = stepBoat(state, { throttle: true }, 0.05)
      assert.ok(navigable(next), `collision resolution for rock ${JSON.stringify(rock)} at angle ${angle}`)
    }
  }
})

test('boundary turns the boat inward and permits recovery without a hard lock', () => {
  let state = { ...createBoatState(), x: WORLD_RADIUS - 0.1, z: 0, heading: Math.PI / 2, speed: 10 }
  state = stepBoat(state, { throttle: true }, 0.05)
  assert.ok(state.boundary)
  assert.ok(Math.hypot(state.x, state.z) < WORLD_RADIUS)
  const recovered = advance(state, { throttle: true }, 180)
  assert.ok(Math.hypot(recovered.x, recovered.z) < WORLD_RADIUS - 10)
  assert.ok(navigable(recovered))
})

test('a dense navigation sweep remains outside the combined land and rock collision area', () => {
  let samples = 0
  for (let x = -45; x <= 45; x += 0.75) {
    for (let z = -35; z <= 35; z += 0.75) {
      const origin = { ...createBoatState(), x, z }
      if (!navigable(origin)) continue
      for (let direction = 0; direction < 16; direction += 1) {
        for (const speed of [-3.4, 10]) {
          const next = stepBoat({ ...origin, heading: direction * Math.PI / 8, speed }, speed > 0 ? { throttle: true } : { brake: true }, 0.05)
          samples += 1
          assert.ok(navigable(next), `collision union penetration from x=${x}, z=${z}, direction=${direction}, speed=${speed}`)
        }
      }
    }
  }
  assert.ok(samples > 100_000, 'sample full forward and reverse approaches around the coast and all rocks')
})

test('a continuous playable route circles the complete island and visits all coastal sectors', () => {
  let state = createBoatState()
  let contacts = 0
  for (let frame = 0; frame < 6000 && state.sectors.length < SECTOR_COUNT; frame += 1) {
    const angle = Math.atan2(state.z, state.x)
    const targetAngle = angle + 0.22
    const target = { x: Math.cos(targetAngle) * 47, z: Math.sin(targetAngle) * 47 }
    const targetHeading = Math.atan2(target.x - state.x, -(target.z - state.z))
    const error = Math.atan2(Math.sin(targetHeading - state.heading), Math.cos(targetHeading - state.heading))
    state = stepBoat(state, { throttle: state.speed < 7, right: error > 0.025, left: error < -0.025 })
    contacts += state.contact ? 1 : 0
    assert.ok(navigable(state), `coastline route intersects terrain at ${state.x}, ${state.z}`)
    assert.ok(Math.hypot(state.x, state.z) < WORLD_RADIUS)
  }
  assert.equal(state.sectors.length, SECTOR_COUNT, 'every section of coast is reachable in one uninterrupted route')
  assert.equal(contacts, 0, 'the route should have clear water around the full island')
  assert.ok(state.distance > 240)
})

test('frame-time spikes are clamped and input-free state remains finite', () => {
  const state = { ...createBoatState(), x: 60, z: 60, speed: 9 }
  const clamped = stepBoat(state, { throttle: true, right: true }, 30)
  const expected = stepBoat(state, { throttle: true, right: true }, 0.05)
  assert.deepEqual(clamped, expected)
  for (const value of [clamped.x, clamped.z, clamped.heading, clamped.speed, clamped.distance]) assert.ok(Number.isFinite(value))
  for (let angle = 0; angle < Math.PI * 2; angle += 0.01) assert.ok(islandRadius(angle) > 15)
})
