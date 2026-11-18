// Combat and pickups: the punch (and the bat, when Rio carries one), and the cash,
// medkits and bats scattered around the city. A punch is one short arc in front of
// the player; it hurts pedestrians, cops and, on the street, whoever is in reach.
import { PLAYER, WANTED } from './config.js';
import { dist } from './random.js';
import { randomRoadPoint } from './world.js';
import { hitPedestrian } from './traffic.js';

export function spawnPickups(game) {
  game.pickups = [
    { kind: 'bat', x: game.city.plaza.cx - 60, y: game.city.plaza.cy, taken: false },
    { kind: 'medkit', x: game.city.hospital.x, y: game.city.hospital.y + 40, taken: false },
    { kind: 'medkit', x: game.city.plaza.cx + 70, y: game.city.plaza.cy - 30, taken: false },
  ];
}

export function spawnCashDrop(game, x, y) {
  game.pickups.push({ kind: 'cash', x, y, taken: false, amount: 20 + Math.floor(game.random() * 40) });
}

/** The punch, resolved once per press: nearest ped or cop in the arc takes the hit. */
export function resolvePunch(game) {
  const player = game.player;
  const range = player.bat ? PLAYER.batRange : PLAYER.punchRange;
  const damage = player.bat ? PLAYER.batDamage : PLAYER.punchDamage;
  const px = player.x + Math.cos(player.angle) * range * 0.6;
  const py = player.y + Math.sin(player.angle) * range * 0.6;
  player.punchAnim = 0.22;
  player.punchCd = PLAYER.punchCooldown;
  if (game.audio) game.audio.punch();

  let hitSomething = false;
  for (const ped of game.peds) {
    if (ped.down > 0 || ped.fare) continue;
    if (dist(px, py, ped.x, ped.y) < range) {
      hitPedestrian(game, ped, false);
      hitSomething = true;
      break;
    }
  }
  if (!hitSomething) {
    for (const cop of game.cops) {
      if (dist(px, py, cop.x, cop.y) < range) {
        game.addHeat(WANTED.punchCop);
        game.toast('You punched a cop! That was a mistake.');
        game.spawnParticles(cop.x, cop.y, 8, '#e5534b');
        // The cop stumbles back.
        cop.x += Math.cos(player.angle) * 40;
        cop.y += Math.sin(player.angle) * 40;
        hitSomething = true;
        break;
      }
    }
  }
  if (hitSomething && game.random() < 0.3) {
    spawnCashDrop(game, player.x + Math.cos(player.angle) * 50, player.y + Math.sin(player.angle) * 50);
  }
}

/** Pickups the player walks over, and the slow health regen on foot. */
export function updatePickups(game, dt) {
  const player = game.player;
  if (!player.inCar) {
    if (player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + PLAYER.regenPerSecond * dt);
    }
    for (const pickup of game.pickups) {
      if (pickup.taken) continue;
      if (dist(player.x, player.y, pickup.x, pickup.y) < 30) {
        pickup.taken = true;
        if (pickup.kind === 'cash') {
          game.cash += pickup.amount || 25;
          game.bestCash = Math.max(game.bestCash, game.cash);
          game.toast(`Found $${pickup.amount || 25} on the street.`);
          if (game.audio) game.audio.cash();
        } else if (pickup.kind === 'medkit') {
          player.health = Math.min(PLAYER.health, player.health + 50);
          game.toast('Medkit: +50 health.');
          if (game.audio) game.audio.pickup();
        } else if (pickup.kind === 'bat') {
          player.bat = true;
          game.toast('You picked up a bat. Punch hits twice as hard now.');
          if (game.audio) game.audio.pickup();
        }
      }
    }
  }
  // A cash drop appears near the player every so often, so the streets keep paying.
  game.cashTimer -= dt;
  if (game.cashTimer <= 0) {
    game.cashTimer = 24 + game.random() * 18;
    const p = randomRoadPoint(game.city, game.random);
    if (dist(p.x, p.y, player.x, player.y) > 350) {
      spawnCashDrop(game, p.x, p.y);
    }
  }
}
