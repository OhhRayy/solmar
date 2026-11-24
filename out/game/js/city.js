// Solmar city — a sun-soaked coastal grid city, generated deterministically
// from a seed so every visit (and every screenshot) shows the same streets.
// Roads run every 200 px; each block holds buildings, trees or a small park;
// the south edge is a beach and the sea.

(function (global) {
  'use strict';

  var WORLD = 3200;
  var ROAD_GAP = 200;
  var ROAD_W = 58;
  var BEACH_Y = 2960;

  // Small deterministic PRNG (mulberry32) so the city never changes shape.
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var ROOF_COLORS = ['#c96f4a', '#7d8aa0', '#b08954', '#5e7d6a', '#8a6f9e', '#a34d4d', '#4d7a8a', '#9c8a6d'];
  var WALL_COLORS = ['#e8dcc8', '#d9c9a8', '#cbb9a0', '#e0d4c0', '#d4c2b2', '#cfd6da'];

  function buildCity(seed) {
    var rng = makeRng(seed || 1);
    var buildings = [];
    var trees = [];
    var parks = [];
    for (var bx = 0; bx < WORLD / ROAD_GAP; bx++) {
      for (var by = 0; by < WORLD / ROAD_GAP; by++) {
        var x0 = bx * ROAD_GAP + ROAD_W / 2 + 8;
        var y0 = by * ROAD_GAP + ROAD_W / 2 + 8;
        var w = ROAD_GAP - ROAD_W - 16;
        var h = ROAD_GAP - ROAD_W - 16;
        if (y0 > BEACH_Y - 40) continue; // sand, no buildings
        var roll = rng();
        if (roll < 0.14) {
          parks.push({ x: x0, y: y0, w: w, h: h });
          var nt = 3 + Math.floor(rng() * 4);
          for (var t = 0; t < nt; t++) {
            trees.push({ x: x0 + 14 + rng() * (w - 28), y: y0 + 14 + rng() * (h - 28), r: 7 + rng() * 5 });
          }
          continue;
        }
        var n = 1 + Math.floor(rng() * 2);
        for (var i = 0; i < n; i++) {
          var bw = 46 + rng() * 52;
          var bh = 40 + rng() * 52;
          var px = x0 + rng() * Math.max(1, w - bw);
          var py = y0 + rng() * Math.max(1, h - bh);
          buildings.push({
            x: px, y: py, w: bw, h: bh,
            wall: WALL_COLORS[Math.floor(rng() * WALL_COLORS.length)],
            roof: ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)],
            tall: rng() < 0.25
          });
        }
        if (rng() < 0.5) {
          trees.push({ x: x0 + 10 + rng() * (w - 20), y: y0 + 10 + rng() * (h - 20), r: 6 + rng() * 4 });
        }
      }
    }
    return { seed: seed || 1, buildings: buildings, trees: trees, parks: parks, rng: rng };
  }

  function roadCenter(n) { return n * ROAD_GAP + ROAD_W / 2; }

  function isOnRoad(x, y) {
    var mx = ((x % ROAD_GAP) + ROAD_GAP) % ROAD_GAP;
    var my = ((y % ROAD_GAP) + ROAD_GAP) % ROAD_GAP;
    return mx < ROAD_W || my < ROAD_W;
  }

  // Snap a point onto the nearest road centre line.
  function snapToRoad(x, y) {
    var mx = ((x % ROAD_GAP) + ROAD_GAP) % ROAD_GAP;
    var my = ((y % ROAD_GAP) + ROAD_GAP) % ROAD_GAP;
    var dx = mx < ROAD_W / 2 ? -mx : (mx > ROAD_GAP - ROAD_W / 2 ? ROAD_GAP - mx : 0);
    var dy = my < ROAD_W / 2 ? -my : (my > ROAD_GAP - ROAD_W / 2 ? ROAD_GAP - my : 0);
    if (Math.abs(dx) < Math.abs(dy) && dx !== 0) return { x: x + dx, y: y, axis: 'y' };
    if (dy !== 0) return { x: x, y: y + dy, axis: 'x' };
    return { x: x, y: y, axis: 'x' };
  }

  function randomRoadPoint(rng) {
    var gx = Math.floor(rng() * (WORLD / ROAD_GAP));
    var gy = Math.floor(rng() * (WORLD / ROAD_GAP));
    var alongX = rng() < 0.5;
    if (alongX) return { x: roadCenter(gx) + (rng() - 0.5) * 20, y: gy * ROAD_GAP + ROAD_W + rng() * (ROAD_GAP - ROAD_W), axis: 'x' };
    return { x: gx * ROAD_GAP + ROAD_W + rng() * (ROAD_GAP - ROAD_W), y: roadCenter(gy) + (rng() - 0.5) * 20, axis: 'y' };
  }

  function hitBuilding(city, x, y, pad) {
    for (var i = 0; i < city.buildings.length; i++) {
      var b = city.buildings[i];
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
    }
    return null;
  }

  function drawCity(ctx, city, cam, vw, vh, time) {
    var x0 = Math.max(0, cam.x - vw / 2 - 40);
    var y0 = Math.max(0, cam.y - vh / 2 - 40);
    var x1 = Math.min(WORLD, cam.x + vw / 2 + 40);
    var y1 = Math.min(WORLD, cam.y + vh / 2 + 40);

    // Ground: warm grass, then sand and sea along the south edge.
    ctx.fillStyle = '#7fae62';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (y1 > BEACH_Y) {
      ctx.fillStyle = '#e8d29a';
      ctx.fillRect(x0, Math.max(y0, BEACH_Y), x1 - x0, y1 - Math.max(y0, BEACH_Y));
      ctx.fillStyle = '#3f8fbf';
      ctx.fillRect(x0, Math.max(y0, BEACH_Y + 90), x1 - x0, y1 - Math.max(y0, BEACH_Y + 90));
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (var wx = x0; wx < x1; wx += 46) {
        var wy = BEACH_Y + 96 + Math.sin(wx * 0.02 + time * 0.0012) * 5;
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + 24, wy);
      }
      ctx.stroke();
    }

    // Parks.
    ctx.fillStyle = '#5d9b4a';
    for (var p = 0; p < city.parks.length; p++) {
      var pk = city.parks[p];
      if (pk.x > x1 || pk.y > y1 || pk.x + pk.w < x0 || pk.y + pk.h < y0) continue;
      ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    }

    // Roads: asphalt with pale sidewalks and dashed centre lines.
    ctx.fillStyle = '#3a3f46';
    for (var gx = 0; gx <= WORLD / ROAD_GAP; gx++) {
      var cx = roadCenter(gx);
      if (cx > x0 - ROAD_W && cx < x1 + ROAD_W) ctx.fillRect(cx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
      if (cx > y0 - ROAD_W && cx < y1 + ROAD_W) ctx.fillRect(x0, cx - ROAD_W / 2, x1 - x0, ROAD_W);
    }
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    ctx.beginPath();
    for (var vx = 0; vx <= WORLD / ROAD_GAP; vx++) {
      var lx = roadCenter(vx);
      if (lx > x0 && lx < x1) { ctx.moveTo(lx, y0); ctx.lineTo(lx, y1); }
      if (lx > y0 && lx < y1) { ctx.moveTo(x0, lx); ctx.lineTo(x1, lx); }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Buildings: wall, roof inset, a few windows, taller ones cast a shadow.
    for (var i = 0; i < city.buildings.length; i++) {
      var b = city.buildings[i];
      if (b.x > x1 || b.y > y1 || b.x + b.w < x0 || b.y + b.h < y0) continue;
      if (b.tall) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      }
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      var cols = Math.max(1, Math.floor(b.w / 18));
      var rows = Math.max(1, Math.floor(b.h / 18));
      for (var cx2 = 0; cx2 < cols; cx2++) {
        for (var cy2 = 0; cy2 < rows; cy2++) {
          ctx.fillRect(b.x + 9 + cx2 * 18, b.y + 9 + cy2 * 18, 7, 7);
        }
      }
    }

    // Palm trees.
    for (var t2 = 0; t2 < city.trees.length; t2++) {
      var tr = city.trees[t2];
      if (tr.x < x0 || tr.x > x1 || tr.y < y0 || tr.y > y1) continue;
      ctx.fillStyle = '#2f7d3a';
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57a047';
      ctx.beginPath();
      ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  global.SolmarCity = {
    WORLD: WORLD, ROAD_GAP: ROAD_GAP, ROAD_W: ROAD_W, BEACH_Y: BEACH_Y,
    buildCity: buildCity, makeRng: makeRng, isOnRoad: isOnRoad,
    snapToRoad: snapToRoad, randomRoadPoint: randomRoadPoint,
    hitBuilding: hitBuilding, drawCity: drawCity
  };
})(window);
