// The wanted level and the law that answers it. Heat rises with crime, locks for a
// few seconds after a fresh offence, then decays while no officer can see the player.
// Foot cops chase and arrest; interceptor cars chase and ram.
import { COP, INTERCEPTOR, WANTED, WORLD } from './config.js';
import { dist, wrapAngle } from './random.js';
import { randomRoadPoint, resolveCircle } from './world.js';
import { collideCars, collideCarWithBuildings, makeCar } from './vehicles.js';

function starsFor(heat) {
  if (heat <= 0) return 0;
  return Math.min(WANTED.maxStars, Math.ceil(heat / 20));
}

export function updateWanted(game, dt) {
  if (game.heatLock > 0) game.heatLock -= dt;
  // Decay only while no officer is close enough to see the player.
  let seen = false;
  for (const cop of game.cops) {
    if (dist(cop.x, cop.y, game.player.x, game.player.y) < WANTED.decayClearRange) { seen = true; break; }
  }
  if (!seen) {
    for (const car of game.cars) {
      if (car.police && dist(car.x, car.y, game.player.x, game.player.y) < WANTED.decayClearRange) { seen = true; break; }
    }
  }
  if (game.heatLock <= 0 && !seen && game.heat > 0) {
    game.heat = Math.max(0, game.heat - WANTED.decayPerSecond * dt);
  }
  game.stars = starsFor(game.heat);
}

function spawnFootCop(game) {
  const p = randomRoadPoint(game.city, game.random);
  // Spawn on a road a little way from the player, never on top of them.
  if (dist(p.x, p.y, game.player.x, game.player.y) < 300) return null;
  return { x: p.x, y: p.y, angle: 0, arrestTimer: 0, giveUp: 0 };
}

function spawnInterceptor(game) {
  const p = randomRoadPoint(game.city, game.random);
  if (dist(p.x, p.y, game.player.x, game.player.y) < 420) return null;
  const car = makeCar(p.x, p.y, Math.atan2(game.player.y - p.y, game.player.x - p.x), 'police', game.random, true);
  car.speed = 300;
  game.cars.push(car);
  return car;
}

export function updatePolice(game, dt) {
  const wantCops = game.stars >= 1 ? Math.min(WANTED.maxFootCops, game.stars) : 0;
  const wantInterceptors = game.stars >= 2 ? Math.min(WANTED.maxInterceptors, game.stars - 1) : 0;

  while (game.cops.length < wantCops) {
    const cop = spawnFootCop(game);
    if (!cop) break;
    game.cops.push(cop);
  }
  let interceptors = 0;
  for (const car of game.cars) if (car.police) interceptors += 1;
  while (interceptors < wantInterceptors) {
    if (!spawnInterceptor(game)) break;
    interceptors += 1;
  }
  // When the heat is gone, the law stands down.
  if (game.stars === 0) {
    game.cops.length = 0;
    game.cars = game.cars.filter((car) => !car.police);
  }

  const player = game.player;
  for (const cop of game.cops) {
    const d = dist(cop.x, cop.y, player.x, player.y);
    if (d > COP.giveUpRange) {
      cop.giveUp += dt;
      if (cop.giveUp > 4) {
        // Teleport the cop back onto a road near the player: the chase continues.
        const p = randomRoadPoint(game.city, game.random);
        cop.x = p.x;
        cop.y = p.y;
        cop.giveUp = 0;
      }
      continue;
    }
    cop.giveUp = 0;
    cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
    const speed = player.inCar ? COP.speed * 1.15 : COP.speed;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    resolveCircle(game.city, cop, 12);
    if (!player.inCar && d < COP.arrestRange) {
      cop.arrestTimer += dt;
      if (cop.arrestTimer >= COP.arrestSeconds) game.busted('The Solmar police caught you on foot.');
    } else {
      cop.arrestTimer = Math.max(0, cop.arrestTimer - dt * 2);
    }
  }

  for (const car of game.cars) {
    if (!car.police) continue;
    car.lightPhase += dt * 6;
    // Steer straight at the player; the wall-slide physics keeps the car out of walls.
    const want = Math.atan2(player.y - car.y, player.x - car.x);
    const turn = wrapAngle(want - car.angle);
    // Interceptors steer hard but not perfectly, so they overshoot a turning player
    // and have to swing back around instead of grinding them into a wall.
    car.angle += Math.max(-1.9, Math.min(1.9, turn)) * dt * 2.2;
    // After a ram the interceptor falls back for a moment instead of grinding the
    // player into a wall, so a chase stays a chase.
    const targetSpeed = car.crashed > 0 ? 220 : INTERCEPTOR.maxSpeed;
    car.speed += (targetSpeed - car.speed) * Math.min(1, 1.4 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
    car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
    if (collideCarWithBuildings(game.city, car)) {
      car.speed *= 0.55;
      if (car.crashed <= 0) {
        car.crashed = 0.5;
        game.spawnParticles(car.x, car.y, 6, '#f2c94c');
      }
    }
    if (car.crashed > 0) car.crashed -= dt;
    // Ram the player's car.
    if (player.car) {
      if (collideCars(car, player.car)) {
        if (car.crashed <= 0 && Math.abs(car.speed) > 200) {
          car.crashed = 0.8;
          game.damagePlayer(INTERCEPTOR.ramDamage, 'rammed by an interceptor');
          game.spawnParticles(player.car.x, player.car.y, 8, '#f2c94c');
          if (game.audio) game.audio.crash();
        }
      }
      // Boxed in: slow, surrounded, and the law takes you.
      const d = dist(car.x, car.y, player.x, player.y);
      if (d < INTERCEPTOR.boxInRange && Math.abs(player.car.speed) < 60) {
        car.boxTimer = (car.boxTimer || 0) + dt;
        if (car.boxTimer >= INTERCEPTOR.boxInSeconds) game.busted('The interceptors boxed you in.');
      } else {
        car.boxTimer = 0;
      }
    }
  }
}
