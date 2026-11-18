// Drawing only: the city, the cars, the people and the effects, painted through a
// camera that follows the player. The HUD and the menu screens live in hud.js.
import { CAR, FONT, PALETTE, ROADS, VIEW } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_FAILED = 'failed';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    ctx.font = `${weight || 400} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.fillText(value, x, y);
  }

  /** The camera's visible rectangle in world units. */
  function visibleRect(game) {
    const cam = game.camera;
    return {
      x: cam.x - VIEW.width / 2 - 40,
      y: cam.y - VIEW.height / 2 - 40,
      w: VIEW.width + 80,
      h: VIEW.height + 80,
    };
  }

  function inView(rect, x, y, w, h) {
    return x + w > rect.x && x < rect.x + rect.w && y + h > rect.y && y < rect.y + rect.h;
  }

  function drawGround(game) {
    const city = game.city;
    const rect = visibleRect(game);
    // Base ground.
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    // Beach and sea along the south edge.
    if (rect.y + rect.h > city.beachY) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(rect.x, Math.max(rect.y, city.beachY), rect.w, Math.max(0, rect.y + rect.h - Math.max(rect.y, city.beachY)));
    }
    if (rect.y + rect.h > city.seaY) {
      const seaTop = Math.max(rect.y, city.seaY);
      ctx.fillStyle = PALETTE.sea;
      ctx.fillRect(rect.x, seaTop, rect.w, rect.y + rect.h - seaTop);
      ctx.fillStyle = PALETTE.seaDeep;
      for (let y = city.seaY + 30; y < rect.y + rect.h; y += 46) {
        for (let x = Math.floor(rect.x / 90) * 90; x < rect.x + rect.w; x += 90) {
          ctx.fillRect(x + ((y / 46) % 2) * 30, y, 42, 3);
        }
      }
    }
    // Parks.
    for (const park of city.parks) {
      if (!inView(rect, park.x, park.y, park.w, park.h)) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = PALETTE.parkDark;
      ctx.fillRect(park.x, park.y, park.w, 8);
    }
    // The palm plaza.
    const plaza = city.plaza;
    if (inView(rect, plaza.x, plaza.y, plaza.w, plaza.h)) {
      ctx.fillStyle = PALETTE.plaza;
      ctx.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
      ctx.fillStyle = '#4fc3e8';
      ctx.beginPath();
      ctx.arc(plaza.cx, plaza.cy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8f6fb';
      ctx.beginPath();
      ctx.arc(plaza.cx, plaza.cy, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    // Roads: sidewalk band, asphalt, centre dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const vx of ROADS.vertical) ctx.fillRect(vx - ROADS.width / 2 - 10, rect.y, ROADS.width + 20, rect.h);
    for (const hy of ROADS.horizontal) ctx.fillRect(rect.x, hy - ROADS.width / 2 - 10, rect.w, ROADS.width + 20);
    ctx.fillStyle = PALETTE.road;
    for (const vx of ROADS.vertical) ctx.fillRect(vx - ROADS.width / 2, rect.y, ROADS.width, rect.h);
    for (const hy of ROADS.horizontal) ctx.fillRect(rect.x, hy - ROADS.width / 2, rect.w, ROADS.width);
    ctx.fillStyle = PALETTE.lane;
    for (const vx of ROADS.vertical) {
      for (let y = Math.floor(rect.y / 44) * 44; y < rect.y + rect.h; y += 44) ctx.fillRect(vx - 2, y, 4, 22);
    }
    for (const hy of ROADS.horizontal) {
      for (let x = Math.floor(rect.x / 44) * 44; x < rect.x + rect.w; x += 44) ctx.fillRect(x, hy - 2, 22, 4);
    }
    // Zebra crossings at every intersection.
    ctx.fillStyle = 'rgba(244, 241, 232, 0.75)';
    for (const vx of ROADS.vertical) {
      for (const hy of ROADS.horizontal) {
        if (!inView(rect, vx - 60, hy - 60, 120, 120)) continue;
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(vx + i * 12 - 4, hy - ROADS.width / 2 + 4, 8, 14);
          ctx.fillRect(vx + i * 12 - 4, hy + ROADS.width / 2 - 18, 8, 14);
        }
      }
    }
    // Buildings with roof detail; some have a rooftop pool.
    for (const b of city.buildings) {
      if (!inView(rect, b.x, b.y, b.w, b.h)) continue;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      ctx.fillRect(b.x, b.y, b.w, 6);
      ctx.fillRect(b.x, b.y, 6, b.h);
      if (b.pool) {
        ctx.fillStyle = '#4fc3e8';
        ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, b.w * 0.6, b.h * 0.4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.3, b.w * 0.5, 3);
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, 14, 10);
        ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, 14, 10);
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(b.x + b.w - 14, b.y + 8, 6, b.h - 16);
      }
    }
    // Trees and palms.
    for (const tree of city.trees) {
      if (!inView(rect, tree.x - 22, tree.y - 22, 44, 44)) continue;
      ctx.fillStyle = '#3f7a37';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d9c4d';
      ctx.beginPath();
      ctx.arc(tree.x - 4, tree.y - 4, tree.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const palm of city.palms) {
      if (!inView(rect, palm.x - 20, palm.y - 20, 40, 40)) continue;
      ctx.strokeStyle = '#8a6b42';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y + 8);
      ctx.lineTo(palm.x + palm.lean * 30, palm.y - 8);
      ctx.stroke();
      ctx.fillStyle = '#4d8f3f';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + palm.lean;
        ctx.beginPath();
        ctx.ellipse(palm.x + palm.lean * 30 + Math.cos(a) * 12, palm.y - 8 + Math.sin(a) * 7, 13, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Named places: garage, bank, hospital.
    drawPlaceLabel(game, city.garage.x, city.garage.y, 'GARAGE', '#f2c94c');
    drawPlaceLabel(game, city.bank.x, city.bank.y, 'BANK', '#f2c94c');
    drawPlaceLabel(game, city.hospital.x, city.hospital.y, 'HOSPITAL', '#e8e8e8');
  }

  function drawPlaceLabel(game, x, y, label, color) {
    const rect = visibleRect(game);
    if (!inView(rect, x - 40, y - 40, 80, 80)) return;
    ctx.fillStyle = color;
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 34);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 26, y - 26, 52, 52);
  }

  function drawCarShape(car, isPlayerCar) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    roundRect(ctx, -CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width, 9);
    ctx.fill();
    ctx.fillStyle = car.color;
    roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 9);
    ctx.fill();
    if (car.police) {
      ctx.fillStyle = '#23262b';
      ctx.fillRect(-6, -CAR.width / 2, 12, CAR.width);
      ctx.fillStyle = '#f4f1e8';
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 4);
      const flash = Math.sin(car.lightPhase) > 0;
      ctx.fillStyle = flash ? '#e5534b' : '#4f8ef7';
      ctx.fillRect(-14, -CAR.width / 2 - 3, 12, 6);
      ctx.fillStyle = flash ? '#4f8ef7' : '#e5534b';
      ctx.fillRect(2, -CAR.width / 2 - 3, 12, 6);
    } else {
      ctx.fillStyle = 'rgba(20, 30, 40, 0.75)';
      roundRect(ctx, -8, -CAR.width / 2 + 5, 20, CAR.width - 10, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(CAR.length / 2 - 10, -CAR.width / 2 + 4, 5, CAR.width - 8);
    }
    // Wheels.
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(-CAR.length / 2 + 8, -CAR.width / 2 - 3, 12, 5);
    ctx.fillRect(-CAR.length / 2 + 8, CAR.width / 2 - 2, 12, 5);
    ctx.fillRect(CAR.length / 2 - 20, -CAR.width / 2 - 3, 12, 5);
    ctx.fillRect(CAR.length / 2 - 20, CAR.width / 2 - 2, 12, 5);
    ctx.restore();
    if (isPlayerCar) {
      ctx.strokeStyle = 'rgba(244, 241, 232, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(car.x, car.y, CAR.length / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPerson(x, y, angle, shirt, scale, punchAnim) {
    const s = scale || 1;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8 * s, 11 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(x, y, 11 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 3 * s, y + Math.sin(angle) * 3 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#23262b';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * (punchAnim > 0 ? 26 : 15) * s, y + Math.sin(angle) * (punchAnim > 0 ? 26 : 15) * s);
    ctx.stroke();
  }

  function drawPickups(game) {
    for (const pickup of game.pickups) {
      if (pickup.taken) continue;
      const bob = Math.sin(game.time * 3 + pickup.x) * 3;
      if (pickup.kind === 'cash') {
        ctx.fillStyle = '#2f9e44';
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y + bob, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4f1e8';
        ctx.font = '700 16px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('$', pickup.x, pickup.y + bob + 6);
      } else if (pickup.kind === 'medkit') {
        ctx.fillStyle = '#f4f1e8';
        ctx.fillRect(pickup.x - 11, pickup.y + bob - 11, 22, 22);
        ctx.fillStyle = '#e5534b';
        ctx.fillRect(pickup.x - 3, pickup.y + bob - 8, 6, 16);
        ctx.fillRect(pickup.x - 8, pickup.y + bob - 3, 16, 6);
      } else if (pickup.kind === 'bat') {
        ctx.strokeStyle = '#8a6b42';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(pickup.x - 10, pickup.y + bob + 8);
        ctx.lineTo(pickup.x + 10, pickup.y + bob - 8);
        ctx.stroke();
      }
    }
  }

  function drawMarkers(game) {
    // Mission target: a pulsing ring and a beam of light.
    if (game.target) {
      const pulse = 1 + Math.sin(game.time * 4) * 0.15;
      ctx.strokeStyle = 'rgba(242, 201, 76, 0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(game.target.x, game.target.y, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(242, 201, 76, 0.12)';
      ctx.fillRect(game.target.x - 6, game.target.y - 260, 12, 260);
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.moveTo(game.target.x, game.target.y - 52);
      ctx.lineTo(game.target.x - 10, game.target.y - 34);
      ctx.lineTo(game.target.x + 10, game.target.y - 34);
      ctx.closePath();
      ctx.fill();
    }
    // Sunset Run checkpoints.
    if (game.mission && game.mission.def.id === 'sunset-run') {
      game.mission.checkpoints.forEach((cp, i) => {
        if (cp.passed) return;
        const current = i === game.mission.checkpointIndex;
        ctx.strokeStyle = current ? '#f2c94c' : 'rgba(244, 241, 232, 0.6)';
        ctx.lineWidth = current ? 5 : 3;
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = current ? '#f2c94c' : '#f4f1e8';
        ctx.font = '700 20px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), cp.x, cp.y + 7);
      });
    }
    // The fare waiting for a cab.
    if (game.mission && game.mission.fare && game.mission.fare.state === 'to-pickup') {
      const ped = game.mission.fare.ped;
      const pulse = 1 + Math.sin(game.time * 5) * 0.2;
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 26 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawParticles(game) {
    for (const p of game.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  /** Paint one frame: the world through the camera, then the sun glare on top. */
  function draw(game, screen) {
    const cam = game.camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14181e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x - cam.x * view.scale + (VIEW.width / 2) * view.scale, view.y - cam.y * view.scale + (VIEW.height / 2) * view.scale);

    drawGround(game);
    drawMarkers(game);
    drawPickups(game);
    // Cars, sorted so the southern ones draw over the northern ones.
    const cars = game.cars.slice().sort((a, b) => a.y - b.y);
    for (const car of cars) drawCarShape(car, car === game.player.car);
    for (const ped of game.peds) {
      if (ped.down > 0) {
        ctx.fillStyle = ped.shirt;
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, 0.9, 0);
      if (ped.fare) {
        ctx.fillStyle = '#f2c94c';
        ctx.font = '700 15px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('$', ped.x, ped.y - 18);
      }
    }
    for (const cop of game.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#2b4a8f', 1, 0);
      if (cop.arrestTimer > 0) {
        ctx.fillStyle = '#e5534b';
        ctx.font = '700 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('!', cop.x, cop.y - 20);
      }
    }
    const player = game.player;
    if (!player.inCar) {
      const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
      if (!blink) drawPerson(player.x, player.y, player.angle, '#2f8f7a', 1, player.punchAnim);
    }
    drawParticles(game);

    // Sun glare, top-left, in screen space.
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const glare = ctx.createRadialGradient(120, 60, 10, 120, 60, 420);
    glare.addColorStop(0, 'rgba(255, 244, 200, 0.20)');
    glare.addColorStop(1, 'rgba(255, 244, 200, 0)');
    ctx.fillStyle = glare;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, ctx, view, text };
}
