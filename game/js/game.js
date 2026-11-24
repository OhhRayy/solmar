// Solmar — main game: player on foot and in cars, wanted stars, police,
// combat, missions, HUD with live minimap, screens, saves and the
// deterministic ?shot= scenes used for screenshots.

(function () {
  'use strict';

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var VW = 1280, VH = 720;
  var SAVE_KEY = 'solmar-save-v3';

  var params = new URLSearchParams(window.location.search);
  var shotName = params.get('shot');
  var seed = parseInt(params.get('seed') || '1', 10) || 1;

  var city = SolmarCity.buildCity(seed);
  window.__solmarCity = city;
  var rng = SolmarCity.makeRng(seed * 7919 + 13);
  var sound = new SoundBank();

  var game = {
    screen: 'title', // title | play | pause | wasted | busted
    time: 0,
    cash: 120,
    health: 100,
    wanted: 0,
    wantedTimer: 0,
    missionIdx: 0,
    missionDoneFlash: 0,
    lastPayout: 0,
    hasBat: false,
    message: '',
    messageTimer: 0,
    autopilot: false,
    shotMode: !!shotName,
    stats: { stolen: 0, punches: 0, missionsDone: 0 }
  };

  var player = {
    x: 1029, y: 1029, angle: 0, speed: 0,
    onFoot: true, car: null, walkPhase: 0
  };

  var cam = { x: player.x, y: player.y };
  var traffic = SolmarEntities.spawnTraffic(city, rng, 16);
  var peds = SolmarEntities.spawnPeds(city, rng, 22);
  var police = [];
  var pickups = [
    { x: 1429, y: 1429, kind: 'bat', taken: false, label: 'Baseball bat' },
    { x: 2029, y: 2029, kind: 'health', taken: false, label: 'First aid' },
    { x: 629, y: 2229, kind: 'health', taken: false, label: 'First aid' }
  ];
  var effects = []; // {x,y,text,life,color}

  var keys = {};
  window.addEventListener('keydown', function (e) {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(e.key.toLowerCase()) >= 0) e.preventDefault();
    if (e.key.toLowerCase() === 'p' && game.screen === 'play') game.screen = 'pause';
    else if (e.key.toLowerCase() === 'p' && game.screen === 'pause') game.screen = 'play';
    if (e.key.toLowerCase() === 'm') sound.setMuted(!sound.muted);
    if (e.key.toLowerCase() === 'enter' && game.screen === 'title') startGame();
    if ((e.key.toLowerCase() === 'enter' || e.key.toLowerCase() === 'r') && (game.screen === 'wasted' || game.screen === 'busted')) restart();
    if (e.key.toLowerCase() === 'e') tryEnterCar();
    if (e.key === ' ') tryPunch();
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('click', function () {
    sound.ensure();
    if (game.screen === 'title') startGame();
  });

  function showMessage(text, secs) {
    game.message = text;
    game.messageTimer = secs || 3;
  }

  function addEffect(x, y, text, color) {
    effects.push({ x: x, y: y, text: text, life: 1.4, color: color || '#fff' });
  }

  function startGame() {
    game.screen = 'play';
    sound.ensure();
    sound.startMusic();
    showMessage('Welcome to Solmar, Dax. Lena is waiting — check the objective.', 4);
  }

  function restart() {
    game.health = 100;
    game.wanted = 0;
    game.screen = 'play';
    player.x = 1029; player.y = 1029; player.onFoot = true; player.car = null; player.speed = 0;
    police = [];
    showMessage('Back on your feet. Stay out of trouble — or don\'t.', 3);
  }

  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: game.cash, health: game.health, missionIdx: game.missionIdx,
        x: player.x, y: player.y, hasBat: game.hasBat, stats: game.stats
      }));
    } catch (e) { /* storage unavailable — the game still plays */ }
  }

  function loadGame() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      var s = JSON.parse(raw);
      game.cash = s.cash; game.health = s.health; game.missionIdx = s.missionIdx;
      player.x = s.x; player.y = s.y; game.hasBat = !!s.hasBat; game.stats = s.stats || game.stats;
      return true;
    } catch (e) { return false; }
  }

  // ---- stealing & combat -------------------------------------------------

  function nearestCar(maxDist) {
    var best = null, bestD = maxDist;
    var all = traffic.concat(police);
    for (var i = 0; i < all.length; i++) {
      var dx = all[i].x - player.x, dy = all[i].y - player.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = all[i]; }
    }
    return best;
  }

  function tryEnterCar() {
    if (game.screen !== 'play') return;
    if (!player.onFoot) {
      // Step out of the car, leaving it parked where it stops.
      var c = player.car;
      c.speed = 0;
      player.onFoot = true;
      player.car = null;
      player.x = c.x - Math.sin(c.angle) * 26;
      player.y = c.y + Math.cos(c.angle) * 26;
      return;
    }
    var car = nearestCar(56);
    if (!car) return;
    player.onFoot = false;
    player.car = car;
    player.angle = car.angle;
    player.speed = 0;
    if (car.kind !== 'police') {
      game.stats.stolen++;
      if (game.wanted < 2) {
        game.wanted = Math.max(game.wanted, 1);
        showMessage('That car is yours now — and the owner called it in. 1 star.', 3);
      } else {
        showMessage('Car jacked. Drive!', 2);
      }
      sound.blip(300, 0.12, 'square', 0.15, 520);
    } else {
      showMessage('You just stole a police cruiser. Bold. Very bold.', 3);
      game.wanted = 5;
    }
    syncPolice();
  }

  function tryPunch() {
    if (game.screen !== 'play' || !player.onFoot) return;
    sound.punch();
    game.stats.punches++;
    var dmg = game.hasBat ? 34 : 18;
    var range = game.hasBat ? 46 : 34;
    // Swing at the nearest pedestrian in front of the player.
    var hit = null, bestD = range;
    for (var i = 0; i < peds.length; i++) {
      var dx = peds[i].x - player.x, dy = peds[i].y - player.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; hit = peds[i]; }
    }
    if (hit) {
      hit.panic = 2;
      hit.x += Math.cos(player.angle) * 26;
      hit.y += Math.sin(player.angle) * 26;
      addEffect(hit.x, hit.y - 14, '-' + dmg, '#ffdd55');
      if (game.wanted < 1) game.wanted = 1;
      syncPolice();
      return;
    }
    var car = nearestCar(range + 10);
    if (car) {
      addEffect(car.x, car.y - 16, 'CLANG', '#ffdd55');
      if (game.wanted < 1) game.wanted = 1;
      syncPolice();
    }
  }

  // ---- police & wanted ---------------------------------------------------

  function syncPolice() {
    var want = SolmarEntities.wantedPoliceCount(game.wanted);
    while (police.length < want) {
      var a = rng() * Math.PI * 2;
      var px = player.x + Math.cos(a) * 420;
      var py = player.y + Math.sin(a) * 420;
      var c = SolmarEntities.makeCar(px, py, 'x', 1, 'police');
      c.speed = 120;
      police.push(c);
    }
    while (police.length > want) police.pop();
    sound.siren(game.wanted > 0);
  }

  function hurtPlayer(amount, cause) {
    if (game.screen !== 'play') return;
    if (game.shotMode) return; // staged scenes never kill the player
    game.health -= amount;
    if (game.health <= 0) {
      game.health = 0;
      sound.wasted();
      sound.siren(false);
      sound.engineStop();
      if (game.wanted >= 3) {
        game.screen = 'busted';
        showMessage('Busted by the Solmar PD.', 3);
      } else {
        game.screen = 'wasted';
        showMessage('Wasted. The city keeps moving without you.', 3);
      }
      saveGame();
    }
  }

  // ---- missions ----------------------------------------------------------

  function currentMission() {
    return SolmarMissions.missionAt(game.missionIdx);
  }

  function checkMission() {
    var m = currentMission();
    if (!m) return;
    var dx = m.target.x - player.x, dy = m.target.y - player.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var ok = d < SolmarMissions.missionRadius(m);
    if (m.kind === 'steal' && player.onFoot) ok = false;
    if (!ok) return;
    game.cash += m.payout;
    game.lastPayout = m.payout;
    game.stats.missionsDone++;
    game.missionIdx++;
    game.missionDoneFlash = 3;
    sound.cash();
    addEffect(player.x, player.y - 30, '+$' + m.payout, '#7dff8a');
    showMessage('Mission complete: ' + m.title + ' — paid $' + m.payout + '.', 4);
    if (game.missionIdx >= SolmarMissions.missionCount()) {
      showMessage('ALL MISSIONS DONE — the debt is paid. Solmar is yours, Dax!', 6);
    }
    saveGame();
  }

  // ---- movement ----------------------------------------------------------

  function movePlayer(dt) {
    var up = keys['w'] || keys['arrowup'];
    var down = keys['s'] || keys['arrowdown'];
    var left = keys['a'] || keys['arrowleft'];
    var right = keys['d'] || keys['arrowright'];

    if (player.onFoot) {
      var mx = (right ? 1 : 0) - (left ? 1 : 0);
      var my = (down ? 1 : 0) - (up ? 1 : 0);
      if (mx || my) {
        var len = Math.sqrt(mx * mx + my * my);
        player.angle = Math.atan2(my / len, mx / len);
        player.speed = 165;
        player.walkPhase += dt * 10;
        var nx = player.x + (mx / len) * player.speed * dt;
        var ny = player.y + (my / len) * player.speed * dt;
        if (!SolmarCity.hitBuilding(city, nx, player.y, 8)) player.x = nx;
        if (!SolmarCity.hitBuilding(city, player.x, ny, 8)) player.y = ny;
      } else {
        player.speed = 0;
      }
      player.x = Math.max(16, Math.min(SolmarCity.WORLD - 16, player.x));
      player.y = Math.max(16, Math.min(SolmarCity.WORLD - 16, player.y));
      return;
    }

    // Arcade driving.
    var car = player.car;
    var accel = up ? 260 : 0;
    var brake = down ? 320 : 0;
    var steer = (left ? -1 : 0) + (right ? 1 : 0);
    var forward = car.speed >= 0 ? 1 : -1;
    car.speed += (accel - brake) * dt;
    if (!up && !down) car.speed *= Math.max(0, 1 - dt * 0.8);
    if (down && car.speed > 0) car.speed -= 320 * dt;
    if (down && car.speed <= 0) car.speed -= 120 * dt; // reverse
    car.speed = Math.max(-90, Math.min(340, car.speed));
    if (Math.abs(car.speed) > 8) {
      car.angle += steer * 1.9 * dt * forward * Math.min(1, Math.abs(car.speed) / 120);
    }
    var nx2 = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny2 = car.y + Math.sin(car.angle) * car.speed * dt;
    var bump = SolmarCity.hitBuilding(city, nx2, ny2, 10);
    if (bump) {
      car.speed *= -0.25;
      sound.crash();
      hurtPlayer(3, 'crash');
      addEffect(car.x, car.y - 20, 'CRASH', '#ffb347');
    } else {
      car.x = nx2;
      car.y = ny2;
    }
    car.x = Math.max(16, Math.min(SolmarCity.WORLD - 16, car.x));
    car.y = Math.max(16, Math.min(SolmarCity.WORLD - 16, car.y));
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = Math.abs(car.speed);
    sound.engine(Math.abs(car.speed) / 340);
  }

  function autopilotDrive(dt) {
    // Shot scenes drive themselves along the roads: pick the waypoint on
    // the current road that leads toward the mission target, so the car
    // follows streets instead of cutting diagonally through buildings.
    var m = currentMission();
    if (!m || player.onFoot || !player.car) return;
    var car = player.car;
    var tx = m.target.x, ty = m.target.y;
    var wp;
    if (Math.abs(tx - car.x) > Math.abs(ty - car.y)) {
      var roadY = Math.round((car.y - 29) / 200) * 200 + 29;
      wp = { x: tx, y: roadY };
    } else {
      var roadX = Math.round((car.x - 29) / 200) * 200 + 29;
      wp = { x: roadX, y: ty };
    }
    var want = Math.atan2(wp.y - car.y, wp.x - car.x);
    var diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.speed = Math.min(car.speed + 240 * dt, 240);
    car.angle += Math.max(-1.9 * dt, Math.min(1.9 * dt, diff * 2.2 * dt));
    var nx = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!SolmarCity.hitBuilding(city, nx, ny, 10)) { car.x = nx; car.y = ny; }
    player.x = car.x; player.y = car.y; player.angle = car.angle; player.speed = Math.abs(car.speed);
  }

  // ---- update ------------------------------------------------------------

  function update(dt) {
    game.time += dt;
    if (game.messageTimer > 0) game.messageTimer -= dt;
    if (game.missionDoneFlash > 0) game.missionDoneFlash -= dt;
    for (var i = effects.length - 1; i >= 0; i--) {
      effects[i].life -= dt;
      effects[i].y -= 22 * dt;
      if (effects[i].life <= 0) effects.splice(i, 1);
    }

    if (game.autopilot) autopilotDrive(dt);
    else movePlayer(dt);

    SolmarEntities.updateTraffic(traffic, dt, rng, SolmarCity.WORLD);
    SolmarEntities.updatePeds(peds, dt, city, player, rng);
    SolmarEntities.updatePolice(police, dt, player, rng, game.time);

    // Traffic bumps the player.
    for (var t = 0; t < traffic.length; t++) {
      var c = traffic[t];
      var dx = c.x - player.x, dy = c.y - player.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 30) {
        if (player.onFoot) {
          hurtPlayer(12, 'traffic');
          var ox = player.x, oy = player.y;
          player.x -= dx * 0.6; player.y -= dy * 0.6;
          // A shove never pushes the player through a wall.
          if (SolmarCity.hitBuilding(city, player.x, player.y, 8)) { player.x = ox; player.y = oy; }
          showMessage('Watch the road! That hurt.', 2);
        } else if (player.car !== c) {
          c.speed *= 0.6;
          player.car.speed *= 0.7;
        }
      }
    }

    // Police ram the player; on foot they catch and bust.
    for (var p = 0; p < police.length; p++) {
      var pc = police[p];
      var pdx = pc.x - player.x, pdy = pc.y - player.y;
      var pd = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pd < 34) {
        if (player.onFoot) {
          hurtPlayer(22, 'police');
          showMessage('The cops are on you — run!', 2);
        } else if (!game.shotMode) {
          player.car.speed *= 0.75;
          hurtPlayer(5, 'ram');
        }
        pc.speed *= 0.4;
      }
    }

    // Pickups.
    for (var k = 0; k < pickups.length; k++) {
      var pk = pickups[k];
      if (pk.taken) continue;
      var kdx = pk.x - player.x, kdy = pk.y - player.y;
      if (Math.sqrt(kdx * kdx + kdy * kdy) < 34) {
        pk.taken = true;
        if (pk.kind === 'bat') { game.hasBat = true; showMessage('Picked up a baseball bat — SPACE hits harder now.', 3); }
        else { game.health = Math.min(100, game.health + 50); showMessage('First aid: +50 health.', 2); }
        sound.pickup();
      }
    }

    // Wanted cools down when the player stays out of sight of police.
    if (game.wanted > 0) {
      game.wantedTimer += dt;
      var nearCop = false;
      for (var q = 0; q < police.length; q++) {
        var qd = Math.hypot(police[q].x - player.x, police[q].y - player.y);
        if (qd < 260) nearCop = true;
      }
      if (!nearCop && game.wantedTimer > 14) {
        game.wanted--;
        game.wantedTimer = 0;
        syncPolice();
        showMessage('Heat is cooling off… ' + game.wanted + ' star' + (game.wanted === 1 ? '' : 's') + ' left.', 2);
      }
    } else {
      game.wantedTimer = 0;
    }

    if (!game.shotMode) checkMission();

    // Camera follows the player, clamped to the world.
    cam.x += (player.x - cam.x) * Math.min(1, dt * 5);
    cam.y += (player.y - cam.y) * Math.min(1, dt * 5);
    cam.x = Math.max(VW / 2 - 60, Math.min(SolmarCity.WORLD - VW / 2 + 60, cam.x));
    cam.y = Math.max(VH / 2 - 60, Math.min(SolmarCity.WORLD - VH / 2 + 60, cam.y));
  }

  // ---- drawing -----------------------------------------------------------

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.onFoot) {
      ctx.rotate(player.angle);
      // A pale ring keeps the on-foot player readable at a glance.
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
      var bob = Math.sin(player.walkPhase) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 5, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#20242c';
      ctx.fillRect(-7, -5 + bob * 0.3, 14, 10);
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath(); ctx.arc(9, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-9, -6, 5, 12); // jacket stripe
      if (game.hasBat) {
        ctx.strokeStyle = '#8a5a2b';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(16, -14); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawMarker() {
    var m = currentMission();
    if (!m) return;
    var pulse = 1 + Math.sin(game.time * 4) * 0.15;
    ctx.save();
    ctx.translate(m.target.x, m.target.y);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,63,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(8, -18); ctx.lineTo(-8, -18); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawPickups() {
    for (var i = 0; i < pickups.length; i++) {
      var pk = pickups[i];
      if (pk.taken) continue;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pk.kind === 'bat' ? '#8a5a2b' : '#e74c3c';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'bat' ? 'BAT' : '+', 0, 4);
      ctx.restore();
    }
  }

  function drawEffects() {
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    for (var i = 0; i < effects.length; i++) {
      var e = effects[i];
      ctx.globalAlpha = Math.max(0, e.life);
      ctx.fillStyle = e.color;
      ctx.fillText(e.text, e.x, e.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    var m = currentMission();
    // Top-left: cash + objective panel.
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(14, 12, 430, 66, 8);
    ctx.fill();
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('$' + game.cash, 28, 44);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(SolmarMissions.objectiveText(m, false), 28, 66);

    // Top-right: health bar + wanted stars.
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(VW - 264, 12, 250, 66, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('HEALTH', VW - 248, 34);
    ctx.fillStyle = '#333';
    ctx.fillRect(VW - 248, 42, 150, 12);
    ctx.fillStyle = game.health > 40 ? '#37d67a' : '#e74c3c';
    ctx.fillRect(VW - 248, 42, 150 * game.health / 100, 12);
    ctx.font = '22px sans-serif';
    var stars = '';
    for (var s = 0; s < 5; s++) stars += s < game.wanted ? '★' : '☆';
    ctx.fillStyle = game.wanted > 0 ? '#ffd23f' : '#888';
    ctx.fillText(stars, VW - 248, 70);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('WANTED', VW - 130, 34);

    // Mission flash banner.
    if (game.missionDoneFlash > 0) {
      ctx.fillStyle = 'rgba(20,60,25,0.85)';
      roundRect(VW / 2 - 190, 96, 380, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#7dff8a';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MISSION COMPLETE  +$' + game.lastPayout, VW / 2, 122);
      ctx.textAlign = 'left';
    }

    // Message line, to the right of the minimap so it is never covered.
    if (game.messageTimer > 0) {
      ctx.fillStyle = 'rgba(10,14,20,0.7)';
      roundRect(200, VH - 56, Math.min(620, 30 + game.message.length * 7), 30, 6);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.font = '14px sans-serif';
      ctx.fillText(game.message, 212, VH - 36);
    }

    drawMinimap();
    drawTargetArrow();
    if (!player.onFoot && player.car) drawSpeedo();
    if (game.hasBat) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('BAT EQUIPPED — SPACE to swing', 200, VH - 76);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawMinimap() {
    var size = 168, mx = 16, my = VH - size - 16;
    var scale = size / SolmarCity.WORLD;
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    roundRect(mx - 6, my - 6, size + 12, size + 12, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, size, size);
    ctx.clip();
    ctx.fillStyle = '#1d2b1a';
    ctx.fillRect(mx, my, size, size);
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 2;
    for (var g = 0; g <= SolmarCity.WORLD / SolmarCity.ROAD_GAP; g++) {
      var c = (g * SolmarCity.ROAD_GAP + SolmarCity.ROAD_W / 2) * scale;
      ctx.beginPath(); ctx.moveTo(mx + c, my); ctx.lineTo(mx + c, my + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my + c); ctx.lineTo(mx + size, my + c); ctx.stroke();
    }
    // Sea.
    ctx.fillStyle = '#2f7fb0';
    ctx.fillRect(mx, my + SolmarCity.BEACH_Y * scale, size, size);
    // Mission target.
    var mm = currentMission();
    if (mm) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(mx + mm.target.x * scale, my + mm.target.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police blips.
    ctx.fillStyle = '#4da3ff';
    for (var i = 0; i < police.length; i++) {
      ctx.beginPath();
      ctx.arc(mx + police[i].x * scale, my + police[i].y * scale, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(mx + player.x * scale, my + player.y * scale);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR', mx + 2, my - 10 + 0);
  }

  function drawTargetArrow() {
    var m = currentMission();
    if (!m) return;
    var dx = m.target.x - player.x, dy = m.target.y - player.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 200) return;
    var ang = Math.atan2(dy, dx);
    var cx = VW / 2 + Math.cos(ang) * 250;
    var cy = VH / 2 + Math.sin(ang) * 170;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(dist) + 'm', cx, cy + 30);
    ctx.textAlign = 'left';
  }

  function drawSpeedo() {
    var car = player.car;
    var kmh = Math.round(Math.abs(car.speed) * 0.9);
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(VW - 190, VH - 96, 176, 80, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(kmh), VW - 52, VH - 44);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('km/h', VW - 28, VH - 44);
    ctx.textAlign = 'left';
    // Speed bar.
    ctx.fillStyle = '#333';
    ctx.fillRect(VW - 176, VH - 34, 148, 8);
    ctx.fillStyle = '#37b6ff';
    ctx.fillRect(VW - 176, VH - 34, 148 * Math.min(1, Math.abs(car.speed) / 340), 8);
  }

  function drawScreenOverlay() {
    if (game.screen === 'play') return;
    ctx.fillStyle = 'rgba(6,10,16,0.72)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';
    if (game.screen === 'title') {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 84px sans-serif';
      ctx.fillText('SOLMAR', VW / 2, 210);
      ctx.fillStyle = '#fff';
      ctx.font = '22px sans-serif';
      ctx.fillText('An open-world crime story — drive, steal, run, survive.', VW / 2, 252);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#cfe0f0';
      ctx.fillText('Dax Mercer owes fixer Lena Cruz one last favour.', VW / 2, 292);
      ctx.fillText('Five missions. Five stars of heat. One way out.', VW / 2, 318);
      ctx.fillStyle = '#7dff8a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Press ENTER or click to start', VW / 2, 380);
      ctx.fillStyle = '#9fb2c8';
      ctx.font = '15px sans-serif';
      ctx.fillText('WASD drive & walk  ·  E steal / enter car  ·  SPACE fight  ·  P pause  ·  M mute', VW / 2, 424);
      ctx.fillText('Progress saves automatically to this browser.', VW / 2, 450);
    } else if (game.screen === 'pause') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 54px sans-serif';
      ctx.fillText('PAUSED', VW / 2, 300);
      ctx.font = '18px sans-serif';
      ctx.fillText('Cash $' + game.cash + '  ·  Missions done ' + game.stats.missionsDone + ' / ' + SolmarMissions.missionCount() + '  ·  Cars stolen ' + game.stats.stolen, VW / 2, 350);
      ctx.fillText('Press P to resume', VW / 2, 390);
    } else if (game.screen === 'wasted') {
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 72px sans-serif';
      ctx.fillText('WASTED', VW / 2, 300);
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText('Press ENTER to get back up', VW / 2, 350);
    } else if (game.screen === 'busted') {
      ctx.fillStyle = '#4da3ff';
      ctx.font = 'bold 72px sans-serif';
      ctx.fillText('BUSTED', VW / 2, 300);
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText('The Solmar PD has you. Press ENTER to try again', VW / 2, 350);
    }
    ctx.textAlign = 'left';
  }

  function render() {
    ctx.clearRect(0, 0, VW, VH);
    ctx.save();
    ctx.translate(VW / 2 - cam.x, VH / 2 - cam.y);
    SolmarCity.drawCity(ctx, city, cam, VW, VH, game.time * 1000);
    drawMarker();
    drawPickups();
    for (var i = 0; i < traffic.length; i++) SolmarEntities.drawCar(ctx, traffic[i], game.time);
    for (var j = 0; j < police.length; j++) SolmarEntities.drawCar(ctx, police[j], game.time);
    for (var k = 0; k < peds.length; k++) SolmarEntities.drawPed(ctx, peds[k]);
    drawPlayer();
    if (!player.onFoot && player.car) SolmarEntities.drawCar(ctx, player.car, game.time);
    drawEffects();
    ctx.restore();
    if (game.screen !== 'title') drawHUD();
    drawScreenOverlay();
  }

  // ---- shot scenes -------------------------------------------------------
  // Deterministic staged states so screenshots show the real systems at work.

  function putPlayerInCarAt(x, y, angle) {
    var car = SolmarEntities.makeCar(x, y, 'x', 1, 'sport');
    car.color = '#d94f3d';
    car.angle = angle;
    car.speed = 200;
    traffic.push(car);
    player.onFoot = false;
    player.car = car;
    player.x = x; player.y = y; player.angle = angle; player.speed = 200;
    cam.x = x; cam.y = y;
  }

  function placePoliceAround(n, dist) {
    police = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + 0.6;
      var c = SolmarEntities.makeCar(
        player.x + Math.cos(a) * dist, player.y + Math.sin(a) * dist, 'x', 1, 'police');
      c.speed = 150;
      police.push(c);
    }
    sound.siren(false);
  }

  function setupShot(name) {
    game.screen = 'play';
    game.autopilot = true;
    window.__solmarShot = true;
    loadGame();
    if (name === 'start') {
      game.screen = 'title';
      game.autopilot = false;
      player.x = 1029; player.y = 1029; player.onFoot = true;
      cam.x = 1029; cam.y = 1029;
      game.cash = 120; game.wanted = 0; game.missionIdx = 0;
      return;
    }
    if (name === 'foot') {
      player.x = 1029; player.y = 1029; player.onFoot = true; player.car = null;
      player.angle = 0.4;
      cam.x = 1029; cam.y = 1029;
      game.cash = 370; game.wanted = 1; game.missionIdx = 0;
      game.health = 88;
      showMessage('On foot in downtown Solmar — the marina kiosk is marked.', 6);
      syncPolice();
      return;
    }
    if (name === 'drive') {
      putPlayerInCarAt(1229, 1229, 0.2);
      game.cash = 770; game.wanted = 3; game.missionIdx = 2;
      game.health = 76;
      placePoliceAround(3, 300);
      showMessage('Three stars — the SPD is on your tail. Lose them!', 6);
      return;
    }
    if (name === 'mission') {
      putPlayerInCarAt(2029, 1229, 0.1);
      game.cash = 1420; game.wanted = 2; game.missionIdx = 2;
      game.health = 92;
      placePoliceAround(2, 380);
      showMessage('Mission 3 — The Handoff: reach the Coral Row arcade.', 6);
      return;
    }
    // finale (default): five stars, full chase, last mission.
    putPlayerInCarAt(1429, 429, 0.05);
    game.cash = 3220; game.wanted = 5; game.missionIdx = 4;
    game.health = 64;
    placePoliceAround(5, 320);
    showMessage('FINAL MISSION — The Big Score: take the vault truck on the causeway!', 6);
  }

  // ---- main loop ---------------------------------------------------------

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.screen === 'play') update(dt);
    else game.time += dt;
    render();
    requestAnimationFrame(frame);
  }

  if (shotName) {
    setupShot(shotName);
    // Warm the scene up so traffic, police and the player are mid-action.
    for (var w = 0; w < 150; w++) {
      if (game.screen === 'play') update(1 / 60);
    }
    game.messageTimer = 6; // keep the message banner visible in the shot
  } else {
    loadGame();
    game.screen = 'title';
  }
  requestAnimationFrame(frame);
})();
