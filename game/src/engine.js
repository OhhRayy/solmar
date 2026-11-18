// The engine: the game's one state object, the fixed-step update that runs every
// system in order, the screens, the save, and the toasts and particles. main.js owns
// the loop and the canvas; everything about what happens lives here.
import { CAR, PLAYER, SAVE_KEY, STEP, TRAFFIC, PEDS, VIEW, WORLD } from './config.js';
import { createRandom, dist } from './random.js';
import { buildCity } from './world.js';
import { spawnParkedCars, collideCars, nearestEnterableCar } from './vehicles.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds, hitPedestrian } from './traffic.js';
import { updateWanted, updatePolice } from './police.js';
import { updatePlayer } from './player.js';
import { spawnPickups, updatePickups } from './combat.js';
import { startMission, updateMission, nextMissionIndex } from './missions.js';
import { createAudio } from './audio.js';

export function createGame(seed) {
  const random = createRandom(seed);
  const city = buildCity(random);
  const game = {
    seed,
    random,
    city,
    time: 0,
    screen: 'title',
    player: {
      x: city.spawn.x, y: city.spawn.y, angle: -Math.PI / 2,
      health: PLAYER.health, inCar: false, car: null,
      bat: false, punchCd: 0, punchAnim: 0, walkPhase: 0, invulnerable: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    pickups: [],
    particles: [],
    toasts: [],
    cash: 0,
    heat: 0,
    heatLock: 0,
    stars: 0,
    mission: null,
    missionsDone: 0,
    jobsDone: 0,
    bestCash: 0,
    missionCooldown: 0,
    missionFailed: null,
    target: null,
    cashTimer: 20,
    camera: { x: city.spawn.x, y: city.spawn.y },
    save: null,
    endReason: '',
    endLoss: 0,
    audio: null,
  };

  game.cars = spawnParkedCars(city, random, 22);
  game.cars.push(...spawnTraffic(city, random, TRAFFIC.count));
  game.peds = spawnPeds(city, random, PEDS.count);
  spawnPickups(game);

  game.audio = createAudio();

  game.toast = (text) => {
    game.toasts.push({ text, life: 4 });
    if (game.toasts.length > 3) game.toasts.shift();
  };

  game.spawnParticles = (x, y, count, color) => {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const speed = 60 + random() * 160;
      game.particles.push({
        x, y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 0.4 + random() * 0.4, maxLife: 0.8,
        color, size: 3 + random() * 4,
      });
    }
    if (game.particles.length > 240) game.particles.splice(0, game.particles.length - 240);
  };

  game.addHeat = (amount) => {
    game.heat = Math.min(100, game.heat + amount);
    game.heatLock = 5;
  };

  game.nearestCar = () => nearestEnterableCar(game, game.player.x, game.player.y);

  /** The nearest stealable car at any distance, for the autopilot's walk target. */
  game.nearestCarAny = () => {
    let best = null;
    let bestD = Infinity;
    for (const car of game.cars) {
      if (car.kind !== 'parked' && car.kind !== 'traffic') continue;
      const d = dist(car.x, car.y, game.player.x, game.player.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  };

  game.damagePlayer = (amount, reason) => {
    const player = game.player;
    if (player.invulnerable > 0) return;
    player.health -= amount;
    player.invulnerable = 0.6;
    if (player.health <= 0) {
      player.health = 0;
      game.wasted(reason || 'Rio Vega is down.');
    }
  };

  game.wasted = (reason) => {
    if (game.screen !== 'play' || game.shotMode) return;
    game.endReason = reason;
    game.endLoss = Math.floor(game.cash * 0.15);
    game.cash -= game.endLoss;
    if (game.audio) game.audio.busted();
    if (game.mission) {
      game.mission = null;
      game.target = null;
    }
    respawn(game);
    game.screen = 'wasted';
  };

  game.busted = (reason) => {
    if (game.screen !== 'play' || game.shotMode) return;
    game.endReason = reason;
    game.endLoss = Math.floor(game.cash * 0.15);
    game.cash -= game.endLoss;
    if (game.audio) game.audio.busted();
    if (game.mission) game.mission = null;
    game.target = null;
    respawn(game);
    game.screen = 'busted';
  };

  game.startNextMission = () => {
    if (game.mission || game.missionCooldown > 0) return false;
    return startMission(game, nextMissionIndex(game));
  };

  return game;
}

function respawn(game) {
  const player = game.player;
  if (player.car) {
    player.car.kind = 'parked';
    player.car.driver = null;
    player.car.speed = 0;
    player.car = null;
    player.inCar = false;
  }
  player.x = game.city.hospital.x;
  player.y = game.city.hospital.y + 90;
  player.health = PLAYER.health;
  player.invulnerable = 2;
  player.bat = false;
  game.heat = 0;
  game.heatLock = 0;
  game.stars = 0;
  game.cops.length = 0;
  game.cars = game.cars.filter((car) => !car.police);
  game.camera.x = player.x;
  game.camera.y = player.y;
}

/** Load the save from this browser, if there is one. */
export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save !== 'object' || save === null) return null;
    return {
      cash: Number(save.cash) || 0,
      missionsDone: Number(save.missionsDone) || 0,
      jobsDone: Number(save.jobsDone) || 0,
      bestCash: Number(save.bestCash) || 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.cash,
      missionsDone: game.missionsDone,
      jobsDone: game.jobsDone,
      bestCash: game.bestCash,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

export function applySave(game, save) {
  if (!save) return;
  game.save = save;
  game.cash = save.cash;
  game.missionsDone = save.missionsDone;
  game.jobsDone = save.jobsDone;
  game.bestCash = save.bestCash;
}

/**
 * One fixed step of the living world. `held` is the held-keys state; `actions` is the
 * one-shot presses for this frame ({enter, punch}), already taken once by the loop.
 * The title screen runs the same world with no player input, as a living backdrop.
 */
export function stepGame(game, held, actions, dt, ambient) {
  game.time += dt;
  if (game.missionCooldown > 0) game.missionCooldown -= dt;
  for (let i = game.toasts.length - 1; i >= 0; i -= 1) {
    game.toasts[i].life -= dt;
    if (game.toasts[i].life <= 0) game.toasts.splice(i, 1);
  }
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const p = game.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.life <= 0) game.particles.splice(i, 1);
  }

  updateTraffic(game, dt);
  updatePeds(game, dt);

  if (!ambient) {
    updatePlayer(game, held, actions, dt);
    updatePickups(game, dt);
    updateWanted(game, dt);
    updatePolice(game, dt);
    updateMission(game, dt);
    checkCarPedHits(game);
    // Car-versus-car bumps for every pair that matters.
    const cars = game.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        collideCars(cars[i], cars[j]);
      }
    }
    if (game.missionFailed && !game.shotMode) {
      game.screen = 'failed';
    }
  }

  // The camera follows the player (or drifts over the plaza on the title screen).
  const targetX = ambient ? game.city.plaza.cx + Math.cos(game.time * 0.08) * 260 : game.player.x;
  const targetY = ambient ? game.city.plaza.cy + Math.sin(game.time * 0.06) * 180 : game.player.y;
  game.camera.x += (targetX - game.camera.x) * Math.min(1, 5 * dt);
  game.camera.y += (targetY - game.camera.y) * Math.min(1, 5 * dt);
  game.camera.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, game.camera.x));
  game.camera.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, game.camera.y));

  if (game.audio) {
    game.audio.update();
    game.audio.setWanted(game.stars);
    game.audio.setEngine(game.player.car ? game.player.car.speed : 0, !!game.player.car);
  }
}

/** A speeding player car that touches a pedestrian in front of it knocks them down. */
function checkCarPedHits(game) {
  const car = game.player.car;
  if (!car || Math.abs(car.speed) < 180) return;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const ped of game.peds) {
    if (ped.down > 0 || ped.fare) continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    if (dx * fx + dy * fy <= 0) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < CAR.length * 0.62) {
      hitPedestrian(game, ped, true);
      car.speed *= 0.75;
    }
  }
}

export { STEP };
