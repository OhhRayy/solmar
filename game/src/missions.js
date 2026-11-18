// The five jobs Mara Sol has for Rio Vega, run in order. Each mission is a small state
// machine: a stage, a timer, and a target the HUD points at. Pass pays cash; the clock
// running out fails it, and the player can retry.
import { MISSIONS, ROADS } from './config.js';
import { dist, pick } from './random.js';
import { randomRoadPoint } from './world.js';

function setTarget(game, x, y, label) {
  game.target = { x, y, label };
}

/** The next job index: the first one not yet finished, or 0 again once all five are done. */
export function nextMissionIndex(game) {
  return game.missionsDone >= MISSIONS.length ? 0 : game.missionsDone;
}

export function startMission(game, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  const mission = { def, index, stage: 'start', timer: def.time, target: null, checkpoints: [], checkpointIndex: 0, fare: null, faresDone: 0 };
  game.mission = mission;
  game.target = null;
  if (def.id === 'hot-wheels') {
    mission.stage = 'steal';
    setTarget(game, game.player.x + 200, game.player.y, 'Steal a car');
    game.toast('Job 1 — Hot Wheels: steal any car, bring it to the Marina Garage.');
  } else if (def.id === 'sunset-run') {
    mission.stage = 'drive';
    mission.checkpoints = pickCheckpoints(game);
    mission.target = mission.checkpoints[0];
    setTarget(game, mission.checkpoints[0].x, mission.checkpoints[0].y, 'Checkpoint 1 of 5');
    game.toast('Job 2 — Sunset Run: 5 checkpoints, 90 seconds. Drive!');
  } else if (def.id === 'lose-heat') {
    mission.stage = 'hide';
    game.heat = 40;
    game.heatLock = 5;
    game.toast('Job 3 — Lose the Heat: the law is on you. Break away and let it cool off.');
  } else if (def.id === 'cab-hustle') {
    mission.stage = 'fare';
    startFare(game);
    game.toast('Job 4 — Cab Hustle: three fares are waiting around the city.');
  } else if (def.id === 'solmar-score') {
    mission.stage = 'bank';
    setTarget(game, game.city.bank.x, game.city.bank.y, 'Reserve Bank');
    game.toast('Job 5 — The Solmar Score: walk into the Reserve Bank and take the vault cash.');
  }
  return true;
}

function pickCheckpoints(game) {
  const pool = game.city.intersections.slice();
  const picks = [];
  let guard = 0;
  while (picks.length < 5 && guard < 200) {
    guard += 1;
    const p = pick(game.random, pool);
    if (picks.every((q) => dist(p.x, p.y, q.x, q.y) > 700)) {
      picks.push({ x: p.x, y: p.y, passed: false });
    }
  }
  // Fall back to spread-out corners if the random draw was unlucky.
  while (picks.length < 5) {
    const fallback = [
      { x: ROADS.vertical[0], y: ROADS.horizontal[0] },
      { x: ROADS.vertical[7], y: ROADS.horizontal[5] },
      { x: ROADS.vertical[7], y: ROADS.horizontal[0] },
      { x: ROADS.vertical[0], y: ROADS.horizontal[5] },
      { x: ROADS.vertical[4], y: ROADS.horizontal[3] },
    ];
    picks.push({ ...fallback[picks.length], passed: false });
  }
  return picks;
}

function startFare(game) {
  const mission = game.mission;
  const pickup = randomRoadPoint(game.city, game.random);
  let dest = randomRoadPoint(game.city, game.random);
  while (dist(pickup.x, pickup.y, dest.x, dest.y) < 800) dest = randomRoadPoint(game.city, game.random);
  const ped = {
    x: pickup.x, y: pickup.y, angle: 0, speed: 0, state: 'wait', stateTimer: 999,
    shirt: '#f2c94c', down: 0, fare: true,
  };
  game.peds.push(ped);
  mission.fare = { state: 'to-pickup', pickup, dest, ped };
  setTarget(game, pickup.x, pickup.y, `Fare ${mission.faresDone + 1} of 3 — pick up`);
}

function completeMission(game) {
  const mission = game.mission;
  if (!mission) return;
  game.cash += mission.def.reward;
  game.jobsDone += 1;
  if (mission.index === game.missionsDone) game.missionsDone += 1;
  game.bestCash = Math.max(game.bestCash, game.cash);
  game.toast(`Job done — ${mission.def.name}: +$${mission.def.reward}.`);
  if (game.audio) game.audio.pass();
  game.mission = null;
  game.target = null;
  game.missionCooldown = 4;
}

function failMission(game, reason) {
  const mission = game.mission;
  if (!mission) return;
  if (mission.fare && mission.fare.ped) {
    const i = game.peds.indexOf(mission.fare.ped);
    if (i >= 0) game.peds.splice(i, 1);
  }
  game.mission = null;
  game.target = null;
  game.missionFailed = reason;
  game.failedMissionIndex = mission.index;
  if (game.audio) game.audio.fail();
}

export function updateMission(game, dt) {
  const mission = game.mission;
  if (!mission) return;
  mission.timer -= dt;
  if (mission.timer <= 0) {
    failMission(game, `Time ran out on ${mission.def.name}.`);
    return;
  }
  const player = game.player;
  if (mission.def.id === 'hot-wheels') {
    if (mission.stage === 'steal') {
      if (player.inCar) {
        mission.stage = 'deliver';
        setTarget(game, game.city.garage.x, game.city.garage.y, 'Marina Garage');
        game.toast('Good wheels. Now bring it to the Marina Garage.');
      } else {
        const car = game.nearestCar && game.nearestCar();
        if (car) setTarget(game, car.x, car.y, 'Steal a car');
      }
    } else if (mission.stage === 'deliver') {
      if (player.inCar && dist(player.x, player.y, game.city.garage.x, game.city.garage.y) < 120) {
        completeMission(game);
      }
    }
  } else if (mission.def.id === 'sunset-run') {
    const cp = mission.checkpoints[mission.checkpointIndex];
    if (cp && dist(player.x, player.y, cp.x, cp.y) < 95) {
      cp.passed = true;
      mission.checkpointIndex += 1;
      game.spawnParticles(cp.x, cp.y, 14, '#f2c94c');
      if (game.audio) game.audio.pickup();
      if (mission.checkpointIndex >= mission.checkpoints.length) {
        completeMission(game);
      } else {
        const next = mission.checkpoints[mission.checkpointIndex];
        setTarget(game, next.x, next.y, `Checkpoint ${mission.checkpointIndex + 1} of 5`);
        game.toast(`Checkpoint ${mission.checkpointIndex} of 5 — ${mission.checkpointIndex + 1} to go.`);
      }
    }
  } else if (mission.def.id === 'lose-heat') {
    if (game.stars === 0) completeMission(game);
  } else if (mission.def.id === 'cab-hustle') {
    const fare = mission.fare;
    if (!fare) return;
    if (fare.state === 'to-pickup') {
      if (player.inCar && dist(player.x, player.y, fare.pickup.x, fare.pickup.y) < 65) {
        const i = game.peds.indexOf(fare.ped);
        if (i >= 0) game.peds.splice(i, 1);
        fare.state = 'to-dest';
        setTarget(game, fare.dest.x, fare.dest.y, `Fare ${mission.faresDone + 1} of 3 — drop off`);
        game.toast('Fare aboard. Take them where the marker says.');
      }
    } else if (fare.state === 'to-dest') {
      if (player.inCar && dist(player.x, player.y, fare.dest.x, fare.dest.y) < 85) {
        mission.faresDone += 1;
        game.cash += 60;
        game.toast(`Fare paid: +$60. (${mission.faresDone} of 3)`);
        if (game.audio) game.audio.cash();
        if (mission.faresDone >= 3) completeMission(game);
        else startFare(game);
      }
    }
  } else if (mission.def.id === 'solmar-score') {
    if (mission.stage === 'bank') {
      if (!player.inCar && dist(player.x, player.y, game.city.bank.x, game.city.bank.y) < 65) {
        mission.stage = 'escape';
        game.heat = 60;
        game.heatLock = 5;
        setTarget(game, game.city.dropoff.x, game.city.dropoff.y, 'Beach Drop-off');
        game.toast('Vault cash grabbed! Three stars — lose the law at the beach.');
        if (game.audio) game.audio.cash();
      }
    } else if (mission.stage === 'escape') {
      if (dist(player.x, player.y, game.city.dropoff.x, game.city.dropoff.y) < 115) {
        completeMission(game);
        game.toast('The Solmar Score is yours. The city is yours, Rio.');
      }
    }
  }
}
