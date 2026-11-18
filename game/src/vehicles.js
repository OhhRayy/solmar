// Cars: arcade physics, parked spawns, and getting in and out. A car is two circles
// (nose and tail) for collision, so it slides and bounces off walls instead of sticking.
import { CAR, CAR_COLORS, PLAYER, TRAFFIC, WANTED, WORLD } from './config.js';
import { dist, pick, range, wrapAngle } from './random.js';
import { randomParkedSpot, resolveCircle } from './world.js';

let nextId = 1;

export function makeCar(x, y, angle, kind, random, police) {
  return {
    id: nextId++,
    kind, // 'parked' | 'traffic' | 'police' | 'player'
    x, y, angle,
    speed: 0,
    color: kind === 'police' ? '#e8e8e8' : pick(random, CAR_COLORS),
    police: !!police,
    driver: kind === 'traffic' ? 'traffic' : null,
    steer: 0,
    throttle: 0,
    crashed: 0,
    lightPhase: random() * Math.PI * 2,
    cruise: TRAFFIC.cruise + range(random, -TRAFFIC.cruiseJitter, TRAFFIC.cruiseJitter),
  };
}

export function spawnParkedCars(city, random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const spot = randomParkedSpot(city, random);
    cars.push(makeCar(spot.x, spot.y, spot.angle, 'parked', random, false));
  }
  return cars;
}

/** The two collision circles of a car, nose and tail. */
export function carCircles(car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  return [
    { x: car.x + fx * (CAR.length / 4), y: car.y + fy * (CAR.length / 4), r: CAR.width / 2 + 2 },
    { x: car.x - fx * (CAR.length / 4), y: car.y - fy * (CAR.length / 4), r: CAR.width / 2 + 2 },
  ];
}

function collideBuildings(city, car) {
  const normal = { x: 0, y: 0 };
  let hit = false;
  // Cars treat buildings and parks as solid, so they stay on the roads.
  const solids = city.buildings.concat(city.parks);
  for (const circle of carCircles(car)) {
    for (let i = 0; i < solids.length; i += 1) {
      const b = solids[i];
      const cx = Math.max(b.x, Math.min(circle.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(circle.y, b.y + b.h));
      const dx = circle.x - cx;
      const dy = circle.y - cy;
      const d = Math.hypot(dx, dy);
      if (d >= circle.r) continue;
      hit = true;
      if (d > 0.001) {
        const push = (circle.r - d) / d;
        car.x += dx * push;
        car.y += dy * push;
        normal.x = dx / d;
        normal.y = dy / d;
      } else {
        // Circle centre inside the rectangle: push out along the shortest side.
        const left = circle.x - b.x;
        const right = b.x + b.w - circle.x;
        const top = circle.y - b.y;
        const bottom = b.y + b.h - circle.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) { car.x = b.x - circle.r; normal.x = -1; normal.y = 0; }
        else if (m === right) { car.x = b.x + b.w + circle.r; normal.x = 1; normal.y = 0; }
        else if (m === top) { car.y = b.y - circle.r; normal.x = 0; normal.y = -1; }
        else { car.y = b.y + b.h + circle.r; normal.x = 0; normal.y = 1; }
      }
    }
  }
  return { hit, normal };
}

/**
 * One physics step for a driven car. `control` is {throttle -1..1, steer -1..1,
 * handbrake}. Walls reflect the velocity (wall-slide), and speed bleeds off on impact.
 * Returns true when the car hit a building hard enough to count as a crash.
 */
export function stepDrivenCar(city, car, control, dt) {
  if (control.throttle > 0) car.speed += CAR.accel * dt;
  else if (control.throttle < 0) {
    // Braking while moving forward, reversing once stopped.
    car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
  } else {
    // Coast down.
    car.speed -= car.speed * 0.9 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  if (control.handbrake) car.speed *= Math.max(0, 1 - 2.4 * dt);

  const steerAuthority = Math.min(1, Math.abs(car.speed) / 120);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += control.steer * CAR.steer * steerAuthority * dir * dt * (control.handbrake ? 1.5 : 1);
  car.steer = control.steer;

  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  car.x += vx * dt;
  car.y += vy * dt;
  car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));

  const { hit, normal } = collideBuildings(city, car);
  if (hit) {
    // Reflect the velocity along the wall normal and bleed speed off.
    const dot = vx * normal.x + vy * normal.y;
    if (dot < 0) {
      const rx = vx - 2 * dot * normal.x;
      const ry = vy - 2 * dot * normal.y;
      const newSpeed = Math.hypot(rx, ry) * 0.45;
      car.speed = newSpeed * (car.speed >= 0 ? 1 : -1);
      car.angle = Math.atan2(ry, rx);
      if (Math.abs(dot) > 160) return true;
    } else {
      car.speed *= 0.7;
    }
  }
  if (car.crashed > 0) car.crashed -= dt;
  return false;
}

/** Push a car out of buildings and parks without changing its speed or heading. */
export function pushCarOutOfSolids(city, car) {
  const { hit } = collideBuildings(city, car);
  return hit;
}

/** Push a car out of buildings with a wall-slide reflection; returns true on a hard hit. */
export function collideCarWithBuildings(city, car) {
  const before = Math.abs(car.speed);
  const { hit, normal } = collideBuildings(city, car);
  if (!hit) return false;
  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  const dot = vx * normal.x + vy * normal.y;
  if (dot < 0) {
    const rx = vx - 2 * dot * normal.x;
    const ry = vy - 2 * dot * normal.y;
    car.speed = Math.hypot(rx, ry) * 0.45 * (car.speed >= 0 ? 1 : -1);
    car.angle = Math.atan2(ry, rx);
    return before > 160;
  }
  car.speed *= 0.7;
  return false;
}

/** Push two cars apart and share their speed, so traffic bumps instead of merging. */
export function collideCars(a, b) {
  const d = dist(a.x, a.y, b.x, b.y);
  const min = CAR.length * 0.72;
  if (d >= min || d < 0.001) return false;
  const push = (min - d) / 2;
  const nx = (b.x - a.x) / d;
  const ny = (b.y - a.y) / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  // Share the speed between the two cars: the total is kept, so a rear-end shunt
  // pushes both cars along instead of grinding them to a halt.
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg;
  b.speed = avg;
  return true;
}

/** The nearest car the player can get into, within enter range. */
export function nearestEnterableCar(game, x, y) {
  let best = null;
  let bestD = CAR.enterRange;
  for (const car of game.cars) {
    if (car === game.player.car) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/**
 * Put the player in a car. Stealing a parked car or a traffic car is a crime; a police
 * car is never enterable. Returns the car or null.
 */
export function enterCar(game, car) {
  if (!car || car.police) return null;
  const player = game.player;
  if (car.kind === 'parked' || car.kind === 'traffic') {
    game.addHeat(car.kind === 'traffic' ? WANTED.stealCar + 5 : WANTED.stealCar);
    game.toast(car.kind === 'traffic' ? 'You jacked a moving car! The law noticed.' : 'You stole a parked car. The law noticed.');
    if (car.driver === 'traffic') car.driver = null;
  }
  car.kind = 'player';
  car.driver = 'player';
  player.car = car;
  player.inCar = true;
  player.x = car.x;
  player.y = car.y;
  return car;
}

/** Step out beside the car, leaving it parked where it stops. */
export function exitCar(game) {
  const player = game.player;
  const car = player.car;
  if (!car) return;
  const side = { x: Math.cos(car.angle + Math.PI / 2), y: Math.sin(car.angle + Math.PI / 2) };
  player.x = car.x + side.x * 34;
  player.y = car.y + side.y * 34;
  const normal = { x: 0, y: 0 };
  resolveCircle(game.city, player, PLAYER.radius, normal);
  car.speed = 0;
  car.kind = 'parked';
  car.driver = null;
  player.car = null;
  player.inCar = false;
  player.angle = car.angle + Math.PI / 2;
}
