// Solmar traffic, pedestrians and police — the living city around the player.
// Traffic cars cruise the road grid and turn at intersections; pedestrians
// stroll the sidewalks; police cruisers hunt the player once wanted stars rise.

(function (global) {
  'use strict';

  var CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33a', '#e8e8e8', '#2f2f33', '#7fb069', '#c97bb8', '#e07b39'];
  var PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];

  function makeCar(x, y, axis, dir, kind) {
    var color = kind === 'police' ? '#1c2733' : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    return {
      x: x, y: y, axis: axis, dir: dir, kind: kind || 'sedan',
      color: color, speed: 0, maxSpeed: 110 + Math.random() * 60,
      angle: axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      len: kind === 'sport' ? 46 : 42, wid: 20, sirenPhase: Math.random() * 6
    };
  }

  function spawnTraffic(city, rng, count) {
    var cars = [];
    for (var i = 0; i < count; i++) {
      var p = SolmarCity.randomRoadPoint(rng);
      var c = makeCar(p.x, p.y, p.axis, rng() < 0.5 ? 1 : -1, rng() < 0.12 ? 'taxi' : 'sedan');
      if (c.kind === 'taxi') c.color = '#f5c518';
      c.speed = c.maxSpeed * (0.5 + rng() * 0.4);
      cars.push(c);
    }
    return cars;
  }

  function spawnPeds(city, rng, count) {
    var peds = [];
    for (var i = 0; i < count; i++) {
      var p = SolmarCity.randomRoadPoint(rng);
      peds.push({
        x: p.x + (rng() - 0.5) * 30, y: p.y + (rng() - 0.5) * 30,
        angle: rng() * Math.PI * 2, speed: 18 + rng() * 22,
        color: PED_COLORS[Math.floor(rng() * PED_COLORS.length)],
        walkPhase: rng() * 6, panic: 0
      });
    }
    return peds;
  }

  function turnAtIntersection(car, rng) {
    // At a road crossing, sometimes switch axis and keep going.
    var gap = SolmarCity.ROAD_GAP;
    var mx = ((car.x % gap) + gap) % gap;
    var my = ((car.y % gap) + gap) % gap;
    var nearX = mx < 34 || mx > gap - 34;
    var nearY = my < 34 || my > gap - 34;
    if (nearX && nearY && rng() < 0.3) {
      if (car.axis === 'x') {
        car.axis = 'y';
        car.dir = rng() < 0.5 ? 1 : -1;
      } else {
        car.axis = 'x';
        car.dir = rng() < 0.5 ? 1 : -1;
      }
    }
  }

  function updateTraffic(cars, dt, rng, world) {
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.kind === 'police') continue; // police are steered by updatePolice
      var target = c.axis === 'x' ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      var diff = target - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += diff * Math.min(1, dt * 4);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      turnAtIntersection(c, rng);
      // Wrap around the city edge so traffic never runs out.
      if (c.x < 0) c.x += world;
      if (c.x > world) c.x -= world;
      if (c.y < 0) c.y += world;
      if (c.y > world) c.y -= world;
    }
  }

  function updatePeds(peds, dt, city, player, rng) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      p.walkPhase += dt * 6;
      var dx = player.x - p.x;
      var dy = player.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 90 && player.speed > 60) p.panic = 1.2; // flee a speeding car
      if (p.panic > 0) {
        p.panic -= dt;
        p.angle = Math.atan2(-dy, -dx);
        p.x += Math.cos(p.angle) * p.speed * 2.2 * dt;
        p.y += Math.sin(p.angle) * p.speed * 2.2 * dt;
      } else {
        if (rng() < dt * 0.25) p.angle += (rng() - 0.5) * 1.6;
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
      }
      if (SolmarCity.hitBuilding(city, p.x, p.y, 2)) {
        p.angle += Math.PI / 2;
        p.x -= Math.cos(p.angle) * p.speed * dt * 2;
        p.y -= Math.sin(p.angle) * p.speed * dt * 2;
      }
      p.x = Math.max(20, Math.min(SolmarCity.WORLD - 20, p.x));
      p.y = Math.max(20, Math.min(SolmarCity.WORLD - 20, p.y));
    }
  }

  // Police cruisers: spawn count scales with wanted level, they steer at the
  // player and ram; on foot they chase as officers instead (see game.js).
  function wantedPoliceCount(wanted) {
    if (wanted <= 0) return 0;
    if (wanted === 1) return 1;
    if (wanted === 2) return 2;
    if (wanted === 3) return 3;
    if (wanted === 4) return 4;
    return 6;
  }

  function updatePolice(police, dt, player, rng, time) {
    for (var i = 0; i < police.length; i++) {
      var c = police[i];
      c.sirenPhase += dt * 6;
      var dx = player.x - c.x;
      var dy = player.y - c.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var want = Math.atan2(dy, dx);
      var diff = want - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += diff * Math.min(1, dt * 3.2);
      var cruise = 150 + Math.min(90, dist * 0.25);
      // In staged shots the cruisers trail the player instead of piling on.
      if (window.__solmarShot && dist < 110) cruise = 70;
      c.speed += (cruise - c.speed) * Math.min(1, dt * 1.4);
      var nx = c.x + Math.cos(c.angle) * c.speed * dt;
      var ny = c.y + Math.sin(c.angle) * c.speed * dt;
      if (SolmarCity.hitBuilding(window.__solmarCity, nx, ny, 4)) {
        // Blocked by a building: turn away instead of driving over the roof.
        c.angle += Math.PI * 0.6;
        c.speed *= 0.5;
      } else {
        c.x = nx;
        c.y = ny;
      }
    }
  }

  function drawCar(ctx, c, time) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-c.len / 2 + 3, -c.wid / 2 + 3, c.len, c.wid);
    ctx.fillStyle = c.color;
    ctx.beginPath();
    var r = 7;
    ctx.moveTo(-c.len / 2 + r, -c.wid / 2);
    ctx.lineTo(c.len / 2 - r, -c.wid / 2);
    ctx.quadraticCurveTo(c.len / 2, -c.wid / 2, c.len / 2, -c.wid / 2 + r);
    ctx.lineTo(c.len / 2, c.wid / 2 - r);
    ctx.quadraticCurveTo(c.len / 2, c.wid / 2, c.len / 2 - r, c.wid / 2);
    ctx.lineTo(-c.len / 2 + r, c.wid / 2);
    ctx.quadraticCurveTo(-c.len / 2, c.wid / 2, -c.len / 2, c.wid / 2 - r);
    ctx.lineTo(-c.len / 2, -c.wid / 2 + r);
    ctx.quadraticCurveTo(-c.len / 2, -c.wid / 2, -c.len / 2 + r, -c.wid / 2);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    ctx.fillRect(-c.len * 0.18, -c.wid / 2 + 3, c.len * 0.34, c.wid - 6);
    ctx.fillStyle = 'rgba(160,210,235,0.8)';
    ctx.fillRect(c.len * 0.16, -c.wid / 2 + 4, 5, c.wid - 8);
    // Headlights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(c.len / 2 - 2, -c.wid / 2 + 2, 3, 4);
    ctx.fillRect(c.len / 2 - 2, c.wid / 2 - 6, 3, 4);
    if (c.kind === 'taxi') {
      ctx.fillStyle = '#222';
      ctx.fillRect(-6, -c.wid / 2 + 2, 12, 5);
    }
    if (c.kind === 'police') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-c.len / 2 + 4, -c.wid / 2 + 3, 8, c.wid - 6);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPD', 0, 3);
      var flash = Math.sin(c.sirenPhase) > 0;
      ctx.fillStyle = flash ? '#ff2a2a' : '#2a6bff';
      ctx.fillRect(-4, -c.wid / 2 - 1, 4, 4);
      ctx.fillStyle = flash ? '#2a6bff' : '#ff2a2a';
      ctx.fillRect(0, -c.wid / 2 - 1, 4, 4);
    }
    ctx.restore();
  }

  function drawPed(ctx, p) {
    var bob = Math.sin(p.walkPhase) * 1.5;
    ctx.save();
    ctx.translate(p.x, p.y + bob * 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 2, Math.sin(p.angle) * 2 - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  global.SolmarEntities = {
    makeCar: makeCar, spawnTraffic: spawnTraffic, spawnPeds: spawnPeds,
    updateTraffic: updateTraffic, updatePeds: updatePeds,
    updatePolice: updatePolice, wantedPoliceCount: wantedPoliceCount,
    drawCar: drawCar, drawPed: drawPed
  };
})(window);
