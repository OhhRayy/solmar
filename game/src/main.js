// Boot and the one loop: Solmar runs on fixed 1/60 s steps (several in a slow frame,
// none in a fast one), and the renderer paints what is there. The game moves between
// six screens: title, play, paused, wasted, busted and failed. One-shot presses are
// taken exactly once per frame and handed to the first step only, so E and the punch
// can never fire twice on the same press.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission|finale (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP } from './config.js';
import { createGame, readSave, applySave, writeSave, stepGame } from './engine.js';
import { createRenderer } from './render.js';
import { drawHud } from './hud.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH } from './input.js';
import { stageShot } from './shots.js';
import { startMission } from './missions.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
const SAVE_EVERY_SECONDS = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
const renderer = createRenderer(canvas);
applySave(game, readSave());

// The playtest and screenshot drivers read the live state here.
window.__solmar = { game, screen: game.screen };

function noHeld() {
  return { x: 0, y: 0, up: false, down: false, left: false, right: false, sprint: false, handbrake: false };
}

function noActions() {
  return { enter: false, punch: false };
}

function runShot(name) {
  const scene = stageShot(name, game);
  window.__solmar.screen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen);
    drawHud(renderer, game, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  let lastSave = 0;

  function announce(message) {
    status.textContent = message;
  }

  // Sound starts on the first gesture, as browsers require.
  const unlockAudio = () => game.audio.ensure();
  window.addEventListener('keydown', unlockAudio, { once: true });
  window.addEventListener('pointerdown', unlockAudio, { once: true });

  function startGame() {
    game.screen = 'play';
    if (!game.mission && game.missionCooldown <= 0) game.startNextMission();
    announce('Playing. Rio Vega is on the streets of Solmar.');
  }

  function handleActions(raw) {
    if (raw & ACTION_PAUSE) {
      if (game.screen === 'play') {
        game.screen = 'paused';
        announce('Paused.');
        return;
      }
      if (game.screen === 'paused') {
        game.screen = 'play';
        announce('Playing.');
        return;
      }
    }
    if (!(raw & ACTION_CONFIRM)) return;
    if (game.screen === 'title') startGame();
    else if (game.screen === 'wasted' || game.screen === 'busted') {
      game.screen = 'play';
      writeSave(game);
      announce('Back on the streets.');
    } else if (game.screen === 'failed') {
      const index = game.failedMissionIndex ?? 0;
      game.missionFailed = null;
      startMission(game, index);
      game.screen = 'play';
      announce('Retrying the job.');
    } else if (game.screen === 'play') {
      if (game.startNextMission()) announce('New job from Mara Sol.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const raw = input.takeActions();
    handleActions(raw);
    const oneShot = { enter: !!(raw & ACTION_ENTER), punch: !!(raw & ACTION_PUNCH) };
    if (game.screen === 'title') {
      while (accumulator >= STEP) {
        stepGame(game, noHeld(), noActions(), STEP, true);
        accumulator -= STEP;
      }
    } else if (game.screen === 'play') {
      let first = true;
      while (accumulator >= STEP && game.screen === 'play') {
        stepGame(game, input.heldState(), first ? oneShot : noActions(), STEP, false);
        first = false;
        accumulator -= STEP;
      }
      if (game.time - lastSave > SAVE_EVERY_SECONDS) {
        lastSave = game.time;
        writeSave(game);
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, game.screen);
    drawHud(renderer, game, game.screen);
    window.__solmar.screen = game.screen;
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') game.screen = 'paused';
  });

  announce('Solmar. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
