// Rio Vega on foot and behind the wheel. On foot he walks, sprints, punches and gets
// in and out of cars; in a car the same keys drive it. One-shot actions arrive here
// already taken exactly once per frame by the engine.
import { PLAYER, WORLD } from './config.js';
import { resolveCircle } from './world.js';
import { enterCar, exitCar, nearestEnterableCar, stepDrivenCar } from './vehicles.js';
import { resolvePunch } from './combat.js';

export function updatePlayer(game, held, actions, dt) {
  const player = game.player;
  if (player.punchCd > 0) player.punchCd -= dt;
  if (player.punchAnim > 0) player.punchAnim -= dt;

  if (player.inCar && player.car) {
    updateDriving(game, held, actions, dt);
    return;
  }
  updateOnFoot(game, held, actions, dt);
}

function updateOnFoot(game, held, actions, dt) {
  const player = game.player;
  // Move in the held direction; diagonal movement is normalised.
  let mx = held.x;
  let my = held.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    const speed = held.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    player.x += mx * speed * dt;
    player.y += my * speed * dt;
    player.angle = Math.atan2(my, mx);
    player.walkPhase += dt * (held.sprint ? 14 : 9);
  }
  player.x = Math.max(24, Math.min(WORLD.width - 24, player.x));
  player.y = Math.max(24, Math.min(WORLD.height - 24, player.y));
  resolveCircle(game.city, player, PLAYER.radius);

  if (actions.enter) {
    const car = nearestEnterableCar(game, player.x, player.y);
    if (car) enterCar(game, car);
    else game.toast('No car in reach. Walk up to a parked car and press E.');
  }
  if (actions.punch && player.punchCd <= 0) {
    resolvePunch(game);
  }
}

function updateDriving(game, held, actions, dt) {
  const player = game.player;
  const car = player.car;
  const control = {
    throttle: held.up ? 1 : held.down ? -1 : 0,
    steer: (held.right ? 1 : 0) - (held.left ? 1 : 0),
    handbrake: held.handbrake,
  };
  const crashed = stepDrivenCar(game.city, car, control, dt);
  if (crashed) {
    game.spawnParticles(car.x, car.y, 10, '#f2c94c');
    if (game.audio) game.audio.crash();
    game.damagePlayer(3, 'crashed the car');
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  if (actions.enter) exitCar(game);
}
