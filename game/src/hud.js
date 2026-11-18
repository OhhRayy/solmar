// The HUD and the menu screens: cash, health, wanted stars, the objective banner,
// the live minimap, the speedometer, the edge arrow to the target, toasts, and the
// title, pause, wasted, busted and failed panels. All drawn in 1280x720 logical space.
import { FONT, PALETTE, STORY, VIEW, WORLD } from './config.js';
import { dist } from './random.js';

const MINIMAP = { x: 20, y: VIEW.height - 190, w: 230, h: 170 };

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function drawHud(renderer, game, screen) {
  const { ctx, view } = renderer;
  ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
  ctx.textBaseline = 'alphabetic';
  if (screen === 'play' || screen === 'paused' || screen === 'failed') {
    drawCashHealth(ctx, game);
    drawStars(ctx, game);
    drawObjective(ctx, game);
    drawMinimap(ctx, game);
    drawEdgeArrow(ctx, game);
    if (game.player.inCar && game.player.car) drawSpeedometer(ctx, game);
    drawToasts(ctx, game);
    if (game.time < 12) drawControlsHint(ctx);
  }
  if (screen === 'title') drawTitle(ctx, game);
  else if (screen === 'paused') drawCenterPanel(ctx, 'Paused', ['The city waits for you.'], 'Press P or Esc to keep playing');
  else if (screen === 'wasted') drawCenterPanel(ctx, 'WASTED', [game.endReason || 'Rio Vega is down.', `You lost $${game.endLoss || 0}.`], 'Press Enter to get back up');
  else if (screen === 'busted') drawCenterPanel(ctx, 'BUSTED', [game.endReason || 'The law caught up with you.', `You lost $${game.endLoss || 0}.`], 'Press Enter to walk free');
  else if (screen === 'failed') drawCenterPanel(ctx, 'JOB FAILED', [game.endReason || 'The job fell apart.', 'Mara Sol is not impressed.'], 'Press Enter to try the job again');
}

function drawCashHealth(ctx, game) {
  panel(ctx, 16, 14, 250, 64);
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.textAlign = 'left';
  ctx.fillText(`$${game.cash.toLocaleString('en-US')}`, 30, 46);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(30, 56, 222, 12);
  ctx.fillStyle = game.player.health > 30 ? PALETTE.cash : PALETTE.health;
  ctx.fillRect(30, 56, 222 * Math.max(0, game.player.health / 100), 12);
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('HEALTH', 30, 52);
}

function drawStars(ctx, game) {
  const flash = game.stars >= 4 && Math.floor(game.time * 3) % 2 === 0;
  const x0 = VIEW.width - 20 - 5 * 34;
  panel(ctx, x0 - 8, 10, 5 * 34 + 16, 52);
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = flash ? '#e5534b' : PALETTE.text;
  ctx.textAlign = 'right';
  ctx.fillText(game.stars > 0 ? 'WANTED' : '', x0 + 5 * 34 - 4, 26);
  for (let i = 0; i < 5; i += 1) {
    const x = x0 + i * 34 + 14;
    starPath(ctx, x, 46, 13);
    if (i < game.stars) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fill();
    } else {
      // Solid dark fill, so the road behind never shows through the star.
      ctx.fillStyle = '#2e3238';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawObjective(ctx, game) {
  const mission = game.mission;
  let title = 'FREE ROAM';
  let line = 'Press Enter for the next job — Mara Sol is waiting at the Palm Plaza.';
  let timer = null;
  if (mission) {
    title = `JOB ${mission.index + 1} — ${mission.def.name.toUpperCase()}`;
    line = objectiveLine(game);
    timer = formatTime(mission.timer);
  } else if (game.missionCooldown > 0) {
    line = game.missionsDone >= 5 ? 'All five jobs done. Solmar is yours, Rio.' : 'Job done. Catch your breath — the next one is coming.';
  }
  const w = 560;
  const x = (VIEW.width - w) / 2;
  panel(ctx, x, 14, w, 58);
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW.width / 2, 36);
  ctx.font = `400 14px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(line, VIEW.width / 2, 58);
  if (timer) {
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = mission.timer < 20 ? '#e5534b' : PALETTE.text;
    ctx.textAlign = 'right';
    ctx.fillText(timer, x + w - 12, 38);
  }
}

function objectiveLine(game) {
  const m = game.mission;
  switch (m.def.id) {
    case 'hot-wheels':
      return m.stage === 'steal' ? 'Steal any car (walk up and press E).' : 'Deliver the car to the Marina Garage.';
    case 'sunset-run':
      return `Hit the checkpoints: ${m.checkpointIndex} of 5 done.`;
    case 'lose-heat':
      return 'Break away from the law until the stars fade.';
    case 'cab-hustle':
      return m.fare && m.fare.state === 'to-pickup' ? `Pick up fare ${m.faresDone + 1} of 3.` : `Drop the fare at the marker. (${m.faresDone} of 3 done)`;
    case 'solmar-score':
      return m.stage === 'bank' ? 'Walk into the Reserve Bank on foot.' : 'Lose the law at the Beach Drop-off.';
    default:
      return m.def.brief;
  }
}

function drawMinimap(ctx, game) {
  const { x, y, w, h } = MINIMAP;
  panel(ctx, x, y, w, h);
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  const px = (wx) => x + wx * sx;
  const py = (wy) => y + wy * sy;
  // Ground, then the sea and the beach.
  ctx.fillStyle = '#c9b48c';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#1b7ea6';
  ctx.fillRect(x, py(game.city.seaY), w, y + h - py(game.city.seaY));
  ctx.fillStyle = '#ecd9a4';
  ctx.fillRect(x, py(game.city.beachY), w, py(game.city.seaY) - py(game.city.beachY));
  // Parks.
  ctx.fillStyle = '#79a95a';
  for (const park of game.city.parks) ctx.fillRect(px(park.x), py(park.y), Math.max(1, park.w * sx), Math.max(1, park.h * sy));
  // Roads.
  ctx.fillStyle = '#3f444c';
  for (const vx of game.city.roadsV) ctx.fillRect(px(vx) - 3, y, 6, h);
  for (const hy of game.city.roadsH) ctx.fillRect(x, py(hy) - 3, w, 6);
  // Buildings.
  ctx.fillStyle = '#8a7a5c';
  for (const b of game.city.buildings) ctx.fillRect(px(b.x), py(b.y), Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  // Target.
  if (game.target) {
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(px(game.target.x), py(game.target.y), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#4f8ef7';
  for (const car of game.cars) {
    if (car.police) {
      ctx.beginPath();
      ctx.arc(px(car.x), py(car.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const cop of game.cops) {
    ctx.fillStyle = '#e5534b';
    ctx.beginPath();
    ctx.arc(px(cop.x), py(cop.y), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = game.player;
  ctx.save();
  ctx.translate(px(p.x), py(p.y));
  ctx.rotate(p.angle);
  ctx.fillStyle = '#f4f1e8';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawEdgeArrow(ctx, game) {
  if (!game.target) return;
  const cam = game.camera;
  const dx = game.target.x - cam.x;
  const dy = game.target.y - cam.y;
  const halfW = VIEW.width / 2 - 50;
  const halfH = VIEW.height / 2 - 50;
  // On screen already: no arrow needed.
  if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) return;
  const scale = Math.min(halfW / Math.abs(dx || 1), halfH / Math.abs(dy || 1));
  const ax = VIEW.width / 2 + dx * scale;
  const ay = VIEW.height / 2 + dy * scale;
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = '#f2c94c';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(dist(cam.x, cam.y, game.target.x, game.target.y) / 10) * 10}m`, ax, ay + 30);
}

function drawSpeedometer(ctx, game) {
  const speed = Math.abs(game.player.car.speed);
  const mph = Math.round(speed * 0.22);
  const x = VIEW.width - 170;
  const y = VIEW.height - 84;
  panel(ctx, x, y, 150, 64);
  ctx.font = `700 34px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'right';
  ctx.fillText(String(mph), x + 108, y + 42);
  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('mph', x + 140, y + 42);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(x + 12, y + 52, 126, 5);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(x + 12, y + 52, 126 * Math.min(1, speed / 540), 5);
}

function drawToasts(ctx, game) {
  ctx.textAlign = 'center';
  let y = VIEW.height - 40;
  for (let i = game.toasts.length - 1; i >= 0; i -= 1) {
    const toast = game.toasts[i];
    const a = Math.min(1, toast.life / 0.6);
    ctx.globalAlpha = a;
    ctx.font = `700 16px ${FONT}`;
    const w = ctx.measureText(toast.text).width + 28;
    panel(ctx, (VIEW.width - w) / 2, y - 24, w, 30);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(toast.text, VIEW.width / 2, y - 3);
    y -= 36;
  }
  ctx.globalAlpha = 1;
}

function drawControlsHint(ctx) {
  ctx.font = `400 14px ${FONT}`;
  ctx.fillStyle = 'rgba(244, 241, 232, 0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('WASD move · Shift sprint · E enter / exit car · Space punch (on foot) / handbrake (in car) · P pause', VIEW.width / 2, VIEW.height - 8);
}

function drawCenterPanel(ctx, title, lines, prompt) {
  ctx.fillStyle = 'rgba(10, 12, 16, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const w = 620;
  const h = 130 + lines.length * 32 + 70;
  const x = (VIEW.width - w) / 2;
  const y = (VIEW.height - h) / 2;
  panel(ctx, x, y, w, h);
  ctx.font = `700 46px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW.width / 2, y + 72);
  ctx.font = `400 20px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, y + 116 + i * 32));
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(prompt, VIEW.width / 2, y + h - 28);
}

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(10, 14, 20, 0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.font = `700 96px ${FONT}`;
  ctx.fillStyle = '#f2c94c';
  ctx.fillText('SOLMAR', VIEW.width / 2, 190);
  ctx.font = `400 22px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('A sun-soaked open-world crime story', VIEW.width / 2, 226);
  STORY.forEach((line, i) => {
    ctx.font = `400 17px ${FONT}`;
    ctx.fillStyle = 'rgba(244, 241, 232, 0.85)';
    ctx.fillText(line, VIEW.width / 2, 268 + i * 24);
  });
  const save = game.save;
  const lines = [
    'WASD / arrows — move and drive    Shift — sprint / handbrake',
    'E — steal and exit cars    Space — punch    P — pause',
    `Jobs finished: ${save ? save.missionsDone : 0} of 5      Best cash: $${save ? save.bestCash.toLocaleString('en-US') : 0}`,
  ];
  lines.forEach((line, i) => {
    ctx.font = `400 16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(line, VIEW.width / 2, 420 + i * 26);
  });
  ctx.font = `700 24px ${FONT}`;
  ctx.fillStyle = Math.floor(game.time * 2) % 2 === 0 ? PALETTE.gold : PALETTE.text;
  ctx.fillText(save && save.cash > 0 ? 'Press Enter — Continue' : 'Press Enter — Start', VIEW.width / 2, 540);
  ctx.font = `400 14px ${FONT}`;
  ctx.fillStyle = 'rgba(244, 241, 232, 0.6)';
  ctx.fillText('An original game. No real city, no real gangsters — just Solmar.', VIEW.width / 2, 690);
}
