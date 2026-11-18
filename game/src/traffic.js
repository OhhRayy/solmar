// Traffic cars and pedestrians: the city alive around the player. Traffic follows the
// road grid, turning at intersections; pedestrians stroll the sidewalks and run from
// crime. Both recycle to a road near the player when they wander too far away.
import { PEDS, PED_SHIRTS, ROADS, TRAFFIC, WANTED, WORLD } from './config.js';
import { dist, pick, range, wrapAngle } from './random.js';
import { nearestIntersection, randomRoadPoint, resolveCircle, sidewalkPoint } from './world.js';
import { makeCar, pushCarOutOfSolids } from './vehicles.js';

const RECYCLE_RANGE = 1100;

function spawnTrafficCar(city, random, near) {
  const p = near || randomRoadPoint(city, random);
  const vertical = Math.abs(p.x - nearestIntersection(city, p.x, p.y).x) < 60;
  const angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
  const car = makeCar(p.x, p.y, angle, 'traffic', random, false);
  car.speed = car.cruise;
  return car;
}

export function spawnTraffic(city, random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) cars.push(spawnTrafficCar(city, random));
  return cars;
}

export function spawnPeds(city, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = sidewalkPoint(city, random);
    peds.push({
      x: p.x, y: p.y,
      angle: random() * Math.PI * 2,
      speed: PEDS.walk,
      state: 'walk',
      stateTimer: range(random, 2, 6),
      shirt: pick(random, PED_SHIRTS),
      down: 0,
      fare: false,
    });
  }
  return peds;
}

/** A traffic car's next waypoint: straight on, or a turn at the intersection ahead. */
function nextTrafficTarget(city, car, random) {
  const here = nearestIntersection(city, car.x, car.y);
  const ahead = car.angle;
  // The intersection the car is heading for, from its current heading.
  const movingVertical = Math.abs(Math.sin(ahead)) > Math.abs(Math.cos(ahead));
  let ni = here.i;
  let nj = here.j;
  if (movingVertical) nj += Math.sin(ahead) > 0 ? 1 : -1;
  else ni += Math.cos(ahead) > 0 ? 1 : -1;
  ni = Math.max(0, Math.min(ROADS.vertical.length - 1, ni));
  nj = Math.max(0, Math.min(ROADS.horizontal.length - 1, nj));
  // At the next intersection choose: mostly straight, sometimes a turn, never a U-turn.
  const roll = random();
  let di = ni - here.i;
  let dj = nj - here.j;
  if (roll < 0.18) {
    const tmp = di; di = -dj; dj = tmp;
  } else if (roll < 0.36) {
    const tmp = di; di = dj; dj = -tmp;
  }
  const ti = Math.max(0, Math.min(ROADS.vertical.length - 1, ni + di));
  const tj = Math.max(0, Math.min(ROADS.horizontal.length - 1, nj + dj));
  return { x: ROADS.vertical[ti], y: ROADS.horizontal[tj] };
}

export function updateTraffic(game, dt) {
  const { city, random, player } = game;
  for (const car of game.cars) {
    if (car.kind !== 'traffic') continue;
    if (!car.target || dist(car.x, car.y, car.target.x, car.target.y) < 46) {
      car.target = nextTrafficTarget(city, car, random);
    }
    // Lane offset: keep right of the road centre.
    const toTarget = Math.atan2(car.target.y - car.y, car.target.x - car.x);
    const laneX = car.target.x + Math.cos(toTarget + Math.PI / 2) * 20;
    const laneY = car.target.y + Math.sin(toTarget + Math.PI / 2) * 20;
    const want = Math.atan2(laneY - car.y, laneX - car.x);
    const turn = wrapAngle(want - car.angle);
    car.angle += Math.max(-2.2, Math.min(2.2, turn)) * dt * 2.4;
    // Slow for the car ahead in the same lane; crossing traffic does not block.
    let blocked = false;
    for (const other of game.cars) {
      if (other === car) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 78) {
        const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
        const sameWay = Math.cos(car.angle) * Math.cos(other.angle) + Math.sin(car.angle) * Math.sin(other.angle);
        if (ahead > 0 && sameWay > 0.3) { blocked = true; break; }
      }
    }
    // A jam that lasts is pushed through slowly instead of freezing the street.
    car.blockedTime = blocked ? (car.blockedTime || 0) + dt : 0;
    const targetSpeed = blocked ? (car.blockedTime > 2.5 ? 45 : 0) : car.cruise;
    car.speed += (targetSpeed - car.speed) * Math.min(1, 1.6 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
    car.y = Math.max(40, Math.min(WORLD.height - 40, car.y));
    // Stay on the roads: buildings and parks push a cutting corner back out.
    pushCarOutOfSolids(city, car);
    // Recycle far-away traffic near the player so the streets stay busy.
    if (dist(car.x, car.y, player.x, player.y) > RECYCLE_RANGE) {
      const p = randomRoadPoint(city, random);
      const d = dist(p.x, p.y, player.x, player.y);
      if (d < RECYCLE_RANGE && d > 500) {
        car.x = p.x;
        car.y = p.y;
        car.target = null;
        car.speed = car.cruise;
      }
    }
  }
}

export function updatePeds(game, dt) {
  const { city, random, player } = game;
  for (const ped of game.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    // A fare waiting for a cab stands still.
    if (ped.state === 'wait') continue;
    const dPlayer = dist(ped.x, ped.y, player.x, player.y);
    const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
    const danger = (dPlayer < 260 && player.heat > 0) || (player.car && dPlayer < 240 && playerSpeed > 140) || (player.punchAnim > 0 && dPlayer < 90);
    if (danger && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.stateTimer = 3;
    }
    if (ped.state === 'flee') {
      ped.stateTimer -= dt;
      // Run away from the player; away from a speeding car means off the road,
      // perpendicular to where it is heading.
      let away;
      if (player.car) {
        const perp = player.car.angle + Math.PI / 2;
        const side = Math.cos(perp) * (ped.x - player.x) + Math.sin(perp) * (ped.y - player.y);
        away = side >= 0 ? perp : perp + Math.PI;
      } else {
        away = Math.atan2(ped.y - player.y, ped.x - player.x);
      }
      ped.angle = away;
      ped.speed = PEDS.flee;
      if (ped.stateTimer <= 0) ped.state = 'walk';
    } else {
      ped.stateTimer -= dt;
      ped.speed = PEDS.walk;
      if (ped.stateTimer <= 0) {
        ped.stateTimer = range(random, 3, 8);
        ped.angle = random() * Math.PI * 2;
      }
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    ped.x = Math.max(40, Math.min(WORLD.width - 40, ped.x));
    ped.y = Math.max(40, Math.min(WORLD.height - 40, ped.y));
    resolveCircle(city, ped, 10);
    if (dist(ped.x, ped.y, player.x, player.y) > RECYCLE_RANGE) {
      const p = sidewalkPoint(city, random);
      if (dist(p.x, p.y, player.x, player.y) < RECYCLE_RANGE && dist(p.x, p.y, player.x, player.y) > 400) {
        ped.x = p.x;
        ped.y = p.y;
        ped.state = 'walk';
      }
    }
  }
}

/** A pedestrian the player's car just ran down, or the player's fist just caught. */
export function hitPedestrian(game, ped, byCar) {
  ped.down = 2.5;
  ped.state = 'walk';
  game.addHeat(byCar ? WANTED.hitPedestrian : WANTED.punchPedestrian);
  game.toast(byCar ? 'You hit a pedestrian! The law noticed.' : 'You shoved a pedestrian. The law noticed.');
  game.spawnParticles(ped.x, ped.y, 10, '#e5534b');
  if (game.audio) game.audio.crash();
}
