// The deterministic screenshot scenes behind ?shot=start|drive|chase|mission|finale. Each one
// plays the real rules forward from a fresh world for a fixed number of steps, steered
// by an autopilot that walks to a car, gets in, and drives the road grid toward a
// target — always forward, turning around a block when the target is behind it, never
// reversing into a building. The same seed always gives the same frame.
import { STEP } from './config.js';
import { dist, wrapAngle } from './random.js';
import { routeWaypoints } from './world.js';
import { stepGame } from './engine.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;
const START_SECONDS = 5;
const DRIVE_SECONDS = 16;
const CHASE_SECONDS = 7;
const MISSION_SECONDS = 16;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** The autopilot's road route to a target, rebuilt when the target moves or is reached. */
export function ensureRoute(game, target) {
  const auto = game.auto;
  const final = auto.route.length > 0 ? auto.route[auto.route.length - 1] : null;
  if (!final || dist(final.x, final.y, target.x, target.y) > 60 || auto.index >= auto.route.length) {
    auto.route = routeWaypoints(game.city, { x: game.player.x, y: game.player.y }, target);
    auto.index = 0;
  }
  return auto.route[auto.index];
}

/**
 * Held keys that drive the player's car toward `target` along the roads. The car only
 * ever drives forward: when the target is behind it, it steers hard and swings around.
 * `cap` limits the cruising speed (the drive scene cruises; the chase runs flat out).
 */
export function driveHeld(game, target, cap) {
  const car = game.player.car;
  const wp = ensureRoute(game, target);
  if (!wp) return { x: 0, y: 0, up: false, down: false, left: false, right: false, sprint: false, handbrake: false };
  if (dist(car.x, car.y, wp.x, wp.y) < 70) game.auto.index += 1;
  const want = Math.atan2(wp.y - car.y, wp.x - car.x);
  const diff = wrapAngle(want - car.angle);
  const steer = clamp(diff * 2.2, -1, 1);
  // Brake for a sharp turn ahead instead of overshooting into a block — but only
  // while already moving fast; a slow car needs the throttle to get around.
  const sharpTurn = Math.abs(diff) > 0.9 && Math.abs(car.speed) > 150;
  // Unstick: if the car is barely moving for a while, back off briefly, then go forward.
  game.auto.stuck = Math.abs(car.speed) < 12 ? (game.auto.stuck || 0) + SAMPLE : 0;
  const reversing = game.auto.stuck > 1.2 && game.auto.stuck < 1.8;
  return {
    x: 0, y: 0,
    up: !reversing && !sharpTurn && (cap === undefined || car.speed < cap),
    down: reversing,
    left: steer < -0.12,
    right: steer > 0.12,
    sprint: false,
    handbrake: false,
  };
}

/** Held keys that walk the player toward a point, sprinting. */
export function walkHeld(game, target) {
  const dx = target.x - game.player.x;
  const dy = target.y - game.player.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: Math.abs(dx / len) > 0.3 ? Math.sign(dx) : 0,
    y: Math.abs(dy / len) > 0.3 ? Math.sign(dy) : 0,
    up: dy < -20,
    down: dy > 20,
    left: dx < -20,
    right: dx > 20,
    sprint: true,
    handbrake: false,
  };
}

export function noActions() {
  return { enter: false, punch: false };
}

/** Put the player on foot a short walk from the nearest parked car, ready to steal it. */
export function stageNearCar(game) {
  const car = game.nearestCarAny();
  if (!car) return;
  game.player.x = car.x - 90;
  game.player.y = car.y + 30;
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
}

/** Drive the car at a far corner of the city, re-picking a new corner when it arrives. */
export function farCornerTarget(game) {
  const corners = [
    { x: 240, y: 240 },
    { x: 3040, y: 240 },
    { x: 240, y: 2240 },
    { x: 3040, y: 2240 },
  ];
  // Stick with the current corner until the car gets there; re-picking every step
  // would make it turn back on itself mid-block.
  if (game.auto.corner && dist(game.auto.corner.x, game.auto.corner.y, game.player.x, game.player.y) > 150) {
    return game.auto.corner;
  }
  let best = corners[0];
  let bestD = -1;
  for (const c of corners) {
    const d = dist(c.x, c.y, game.player.x, game.player.y);
    if (d > bestD) { bestD = d; best = c; }
  }
  game.auto.corner = best;
  return best;
}

/** The farthest north corner, for the finale getaway: the escape stage ends
 *  if the player comes within 115 of the Beach Drop-off, and the coast road
 *  at y≈2240 passes ~80 from it — so the getaway runs north, away from the
 *  dropoff, and the JOB 5 banner stays up for the whole shot. */
export function farNorthCornerTarget(game) {
  const corners = [
    { x: 240, y: 240 },
    { x: 3040, y: 240 },
  ];
  if (game.auto.northCorner && dist(game.auto.northCorner.x, game.auto.northCorner.y, game.player.x, game.player.y) > 150) {
    return game.auto.northCorner;
  }
  let best = corners[0];
  let bestD = -1;
  for (const c of corners) {
    const d = dist(c.x, c.y, game.player.x, game.player.y);
    if (d > bestD) { bestD = d; best = c; }
  }
  game.auto.northCorner = best;
  return best;
}

/** Run the world forward for `seconds`, steered by `pilot(game) -> {held, actions}`. */
function simulate(game, seconds, pilot) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const { held, actions } = pilot(game);
    stepGame(game, held, actions, SAMPLE, false);
    if (game.screen !== 'play') break;
  }
}

/**
 * Set `game` to the named scene (start, drive, chase, mission or finale; any other
 * name is start) and return the screen to draw over it.
 */
export function stageShot(name, game) {
  game.shotMode = true;
  game.auto = { route: [], index: 0, stuck: 0 };
  if (name !== 'drive' && name !== 'chase' && name !== 'mission' && name !== 'finale') {
    const steps = Math.round(START_SECONDS / SAMPLE);
    for (let i = 0; i < steps; i += 1) stepGame(game, noHeld(), noActions(), SAMPLE, true);
    return { screen: SCREEN_TITLE };
  }

  game.screen = 'play';
  if (name === 'drive') {
    stageNearCar(game);
    simulate(game, DRIVE_SECONDS, (g) => {
      if (!g.player.inCar) {
        const car = g.nearestCarAny();
        const held = walkHeld(g, car);
        const actions = noActions();
        if (dist(g.player.x, g.player.y, car.x, car.y) < 60) actions.enter = true;
        return { held, actions };
      }
      return { held: driveHeld(g, farCornerTarget(g), 260), actions: noActions() };
    });
  } else if (name === 'chase') {
    stageNearCar(game);
    // Get in the car, then turn the heat all the way up before the chase begins.
    simulate(game, 6, (g) => {
      if (!g.player.inCar) {
        const car = g.nearestCarAny();
        const actions = noActions();
        if (dist(g.player.x, g.player.y, car.x, car.y) < 60) actions.enter = true;
        return { held: walkHeld(g, car), actions };
      }
      return { held: driveHeld(g, farCornerTarget(g)), actions: noActions() };
    });
    game.heat = 80;
    game.heatLock = 5;
    simulate(game, CHASE_SECONDS, (g) => ({ held: driveHeld(g, farCornerTarget(g)), actions: noActions() }));
  } else if (name === 'mission') {
    stageNearCar(game);
    // Sunset Run: five checkpoints on a 90-second clock. Sixteen seconds in, the job
    // is still running, with a timer, a target arrow and checkpoints on the road.
    startMission(game, 1);
    simulate(game, MISSION_SECONDS, (g) => {
      if (!g.player.inCar) {
        const car = g.nearestCarAny();
        const actions = noActions();
        if (dist(g.player.x, g.player.y, car.x, car.y) < 60) actions.enter = true;
        return { held: walkHeld(g, car), actions };
      }
      const target = g.target || g.city.garage;
      return { held: driveHeld(g, target, 420), actions: noActions() };
    });
  } else if (name === 'finale') {
    stageNearCar(game);
    // The Solmar Score getaway: steal a car, then run the escape stage flat
    // out at five stars. The mission is staged straight into 'escape' with
    // the Beach Drop-off as the target, so the frame shows the JOB 5 banner,
    // the timer, the target arrow and the interceptors closing in.
    simulate(game, 6, (g) => {
      if (!g.player.inCar) {
        const car = g.nearestCarAny();
        const actions = noActions();
        if (dist(g.player.x, g.player.y, car.x, car.y) < 60) actions.enter = true;
        return { held: walkHeld(g, car), actions };
      }
      return { held: driveHeld(g, farNorthCornerTarget(g)), actions: noActions() };
    });
    startMission(game, 4);
    game.mission.stage = 'escape';
    game.target = { x: game.city.dropoff.x, y: game.city.dropoff.y, label: 'Beach Drop-off' };
    game.heat = 100;
    game.heatLock = 30;
    // Three phases: flat out, then a slow stretch so the interceptors —
    // which steer straight at the player through the blocks and lose speed
    // on buildings — can close in, then flat out again so the final frame
    // shows the car at full speed with the law right behind it.
    simulate(game, 6, (g) => ({ held: driveHeld(g, farNorthCornerTarget(g)), actions: noActions() }));
    simulate(game, 6, (g) => ({ held: driveHeld(g, farNorthCornerTarget(g), 120), actions: noActions() }));
    simulate(game, 5, (g) => ({ held: driveHeld(g, farNorthCornerTarget(g)), actions: noActions() }));
  }
  return { screen: SCREEN_PLAY };
}

function noHeld() {
  return { x: 0, y: 0, up: false, down: false, left: false, right: false, sprint: false, handbrake: false };
}
