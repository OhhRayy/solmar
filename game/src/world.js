// The city of Solmar itself: a seeded road grid, the buildings, parks, the palm plaza,
// the beach and the sea, plus the collision and road-routing helpers every other system
// leans on. Nothing here draws or steps; it only builds and answers questions.
import { BUILDING_COLORS, ROADS, WORLD } from './config.js';
import { angle, int, pick, range } from './random.js';

const BLOCK_MARGIN = 16;

/** A rectangle the camera and the minimap treat as a city block. */
function blockRect(vx0, vx1, hy0, hy1) {
  return { x: vx0 + ROADS.width / 2 + BLOCK_MARGIN, y: hy0 + ROADS.width / 2 + BLOCK_MARGIN, w: vx1 - vx0 - ROADS.width - BLOCK_MARGIN * 2, h: hy1 - hy0 - ROADS.width - BLOCK_MARGIN * 2 };
}

export function buildCity(random) {
  const buildings = [];
  const parks = [];
  const palms = [];
  const trees = [];
  const v = ROADS.vertical;
  const h = ROADS.horizontal;

  // The plaza is the block at the middle of the grid; the beachfront row stays open sand.
  const plazaBlock = { col: 3, row: 2 };
  const plaza = blockRect(v[plazaBlock.col], v[plazaBlock.col + 1], h[plazaBlock.row], h[plazaBlock.row + 1]);
  plaza.cx = plaza.x + plaza.w / 2;
  plaza.cy = plaza.y + plaza.h / 2;

  for (let col = 0; col < v.length - 1; col += 1) {
    for (let row = 0; row < h.length - 1; row += 1) {
      const rect = blockRect(v[col], v[col + 1], h[row], h[row + 1]);
      if (col === plazaBlock.col && row === plazaBlock.row) {
        for (let i = 0; i < 10; i += 1) {
          palms.push({ x: rect.x + 30 + random() * (rect.w - 60), y: rect.y + 30 + random() * (rect.h - 60), lean: range(random, -0.2, 0.2) });
        }
        continue;
      }
      // One block in six is a park; the rest hold one to three buildings.
      if (random() < 0.16) {
        parks.push(rect);
        for (let i = 0; i < 6; i += 1) {
          trees.push({ x: rect.x + 24 + random() * (rect.w - 48), y: rect.y + 24 + random() * (rect.h - 48), r: range(random, 12, 20) });
        }
        continue;
      }
      const lots = int(random, 1, 3);
      for (let lot = 0; lot < lots; lot += 1) {
        const bw = rect.w / lots;
        const bx = rect.x + lot * bw;
        const pad = 10;
        const b = {
          x: bx + pad,
          y: rect.y + pad + random() * 14,
          w: bw - pad * 2,
          h: rect.h - pad * 2 - random() * 30,
          color: pick(random, BUILDING_COLORS),
          pool: random() < 0.22,
          tall: random() < 0.3,
        };
        if (b.w > 60 && b.h > 60) buildings.push(b);
      }
    }
  }

  // Beachfront palms along the sand.
  for (let i = 0; i < 14; i += 1) {
    palms.push({ x: 120 + random() * (WORLD.width - 240), y: 2290 + random() * 60, lean: range(random, -0.25, 0.25) });
  }

  const city = {
    buildings,
    parks,
    palms,
    trees,
    plaza,
    beachY: 2280,
    seaY: 2380,
    garage: { x: v[6] + 150, y: h[1] - 8, label: 'Marina Garage' },
    hospital: { x: v[1] - 6, y: h[4] + 150, label: 'Solmar General' },
    bank: { x: v[4] + 150, y: h[2] - 8, label: 'Reserve Bank' },
    dropoff: { x: v[2], y: 2320, label: 'Beach Drop-off' },
    spawn: { x: plaza.cx, y: plaza.cy + 40 },
    roadsV: ROADS.vertical,
    roadsH: ROADS.horizontal,
    intersections: [],
  };
  for (let i = 0; i < v.length; i += 1) {
    for (let j = 0; j < h.length; j += 1) city.intersections.push({ x: v[i], y: h[j], i, j });
  }
  return city;
}

/** The closest point on a rectangle to (x, y), and how far away it is. */
function closestOnRect(rect, x, y) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return { x: cx, y: cy, d: Math.hypot(x - cx, y - cy) };
}

/**
 * Push a circle out of every building it overlaps. Mutates p and returns true when a
 * collision happened; the push direction is written to `normal` when one is given.
 */
export function resolveCircle(city, p, r, normal) {
  let hit = false;
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    const c = closestOnRect(b, p.x, p.y);
    if (c.d >= r) continue;
    hit = true;
    if (c.d > 0.001) {
      const push = (r - c.d) / c.d;
      const dx = (p.x - c.x) * push;
      const dy = (p.y - c.y) * push;
      p.x += dx;
      p.y += dy;
      if (normal) {
        normal.x = (p.x - c.x) / Math.max(0.001, Math.hypot(p.x - c.x, p.y - c.y));
        normal.y = (p.y - c.y) / Math.max(0.001, Math.hypot(p.x - c.x, p.y - c.y));
      }
    } else {
      // Centre inside the building: push out along the shortest side.
      const left = p.x - b.x;
      const right = b.x + b.w - p.x;
      const top = p.y - b.y;
      const bottom = b.y + b.h - p.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) { p.x = b.x - r; if (normal) { normal.x = -1; normal.y = 0; } }
      else if (m === right) { p.x = b.x + b.w + r; if (normal) { normal.x = 1; normal.y = 0; } }
      else if (m === top) { p.y = b.y - r; if (normal) { normal.x = 0; normal.y = -1; } }
      else { p.y = b.y + b.h + r; if (normal) { normal.x = 0; normal.y = 1; } }
    }
  }
  return hit;
}

/** True when the point is on a road (or the beach walkway), false inside a block. */
export function onRoad(city, x, y) {
  const half = ROADS.width / 2;
  for (const vx of ROADS.vertical) if (Math.abs(x - vx) <= half) return true;
  for (const hy of ROADS.horizontal) if (Math.abs(y - hy) <= half) return true;
  return y >= city.beachY - 40;
}

/** The intersection nearest a point, as grid indices. */
export function nearestIntersection(city, x, y) {
  let best = city.intersections[0];
  let bestD = Infinity;
  for (const p of city.intersections) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * Waypoints along the road grid from `from` to `to`: out to the nearest intersection,
 * across the grid in straight runs, then in to the target. Cars that follow these never
 * cut through a building.
 */
export function routeWaypoints(city, from, to) {
  const a = nearestIntersection(city, from.x, from.y);
  const b = nearestIntersection(city, to.x, to.y);
  const points = [{ x: a.x, y: a.y }];
  let i = a.i;
  let j = a.j;
  while (i !== b.i) {
    i += b.i > i ? 1 : -1;
    points.push({ x: ROADS.vertical[i], y: ROADS.horizontal[j] });
  }
  while (j !== b.j) {
    j += b.j > j ? 1 : -1;
    points.push({ x: ROADS.vertical[i], y: ROADS.horizontal[j] });
  }
  points.push({ x: to.x, y: to.y });
  return points;
}

/** A random point on a road, for spawning traffic, pedestrians and fares. */
export function randomRoadPoint(city, random) {
  if (random() < 0.5) {
    const vx = pick(random, ROADS.vertical);
    return { x: vx + range(random, -30, 30), y: range(random, 120, 2200) };
  }
  const hy = pick(random, ROADS.horizontal);
  return { x: range(random, 120, 3160), y: hy + range(random, -30, 30) };
}

/** A random parking spot beside a road, facing along it. */
export function randomParkedSpot(city, random) {
  const vertical = random() < 0.5;
  const side = random() < 0.5 ? 1 : -1;
  if (vertical) {
    const vx = pick(random, ROADS.vertical);
    return { x: vx + side * 38, y: range(random, 300, 2100), angle: side > 0 ? Math.PI / 2 : -Math.PI / 2 };
  }
  const hy = pick(random, ROADS.horizontal);
  return { x: range(random, 300, 3000), y: hy + side * 38, angle: side > 0 ? 0 : Math.PI };
}

/** A point on the sidewalk near a road point, where pedestrians stroll. */
export function sidewalkPoint(city, random) {
  const p = randomRoadPoint(city, random);
  const a = angle(random);
  return { x: p.x + Math.cos(a) * 62, y: p.y + Math.sin(a) * 62 };
}
