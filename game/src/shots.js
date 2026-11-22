// Velvet Vault — the screenshot scenes behind ?shot=start|play|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed always
// gives the same frame.
//
// The autopilot plans on a coarse grid: a breadth-first search around the walls gives it
// a route to the next loot (or the exit), and each step it scores the ways it could move
// toward the next cell on that route, staying put when the ground ahead is watched, so
// it waits out a sweeping cone instead of walking into it.
import { STEP } from './config.js';
import { createWorld, moveCircle, pointWatched, step } from './world.js';
import { PLAYER } from './config.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const END_LIMIT_SECONDS = 180;
const DIRS = [
  [0, 0],
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const CELL = 20;
const COLS = 64;
const ROWS = 36;

const gridCache = new Map();

function buildGrid(level) {
  const blocked = new Uint8Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const x = col * CELL + CELL / 2;
      const y = row * CELL + CELL / 2;
      for (const w of level.walls) {
        const pad = PLAYER.radius + 3;
        if (x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad) {
          blocked[row * COLS + col] = 1;
          break;
        }
      }
    }
  }
  return blocked;
}

function gridFor(levelIndex, level) {
  if (!gridCache.has(levelIndex)) gridCache.set(levelIndex, buildGrid(level));
  return gridCache.get(levelIndex);
}

function cellOf(x, y) {
  return {
    col: Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))),
    row: Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL))),
  };
}

// Breadth-first route around the walls, from one world point to another. Returns cell
// centres, start cell first, goal cell last; [] when no route exists.
function findRoute(world, fromX, fromY, toX, toY) {
  const blocked = gridFor(world.levelIndex, world.level);
  const start = cellOf(fromX, fromY);
  const goal = cellOf(toX, toY);
  const startKey = start.row * COLS + start.col;
  const goalKey = goal.row * COLS + goal.col;
  if (blocked[goalKey]) return [];
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const seen = new Uint8Array(COLS * ROWS);
  const queue = [startKey];
  seen[startKey] = 1;
  let head = 0;
  while (head < queue.length) {
    const key = queue[head];
    head += 1;
    if (key === goalKey) break;
    const col = key % COLS;
    const row = (key / COLS) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const nkey = nr * COLS + nc;
      if (seen[nkey] || blocked[nkey]) continue;
      // No cutting a corner through a wall.
      if (dc !== 0 && dr !== 0 && (blocked[row * COLS + nc] || blocked[nr * COLS + col])) continue;
      seen[nkey] = 1;
      prev[nkey] = key;
      queue.push(nkey);
    }
  }
  if (!seen[goalKey]) return [];
  const cells = [];
  let key = goalKey;
  while (key !== -1) {
    cells.push(key);
    key = prev[key];
  }
  cells.reverse();
  return cells.map((k) => ({ x: (k % COLS) * CELL + CELL / 2, y: ((k / COLS) | 0) * CELL + CELL / 2 }));
}

function nearestGoal(world) {
  const p = world.player;
  if (world.exitOpen) {
    const e = world.level.exit;
    return { x: e.x + e.w / 2, y: e.y + e.h / 2, item: null };
  }
  let best = null;
  let bestD = Infinity;
  for (const item of world.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - p.x, item.y - p.y);
    if (d < bestD) {
      best = item;
      bestD = d;
    }
  }
  return best ? { x: best.x, y: best.y, item: best } : null;
}

function dangerAt(world, x, y) {
  let danger = 0;
  if (pointWatched(world, x, y)) danger += 1;
  for (const guard of world.guards) {
    const d = Math.hypot(guard.x - x, guard.y - y);
    if (d < 70) danger += (70 - d) / 70;
  }
  return danger;
}

// One autopilot move: follow the route to the goal, scoring each way it could step by
// how much closer it gets to the next route cell, minus a heavy penalty for watched
// ground; grab when standing on loot. Exported so the world can be play-tested headless.
export function autopilot(world, pilot) {
  const p = world.player;
  const goal = nearestGoal(world);
  if (!goal) return { mx: 0, my: 0, sneak: false, grab: false, coinAt: null, empPressed: false };
  if (goal.item && Math.hypot(goal.item.x - p.x, goal.item.y - p.y) < PLAYER.grabReach - 4) {
    return { mx: 0, my: 0, sneak: false, grab: true, coinAt: null, empPressed: false };
  }
  const goalKey = goal.item ? `loot-${goal.item.x}-${goal.item.y}` : 'exit';
  if (pilot.goalKey !== goalKey) {
    pilot.goalKey = goalKey;
    pilot.route = findRoute(world, p.x, p.y, goal.x, goal.y);
    pilot.routeIndex = 0;
  }
  // Walk the route; skip cells already reached.
  let steer = { x: goal.x, y: goal.y };
  if (pilot.route && pilot.route.length > 0) {
    while (pilot.routeIndex < pilot.route.length) {
      const cell = pilot.route[pilot.routeIndex];
      if (Math.hypot(cell.x - p.x, cell.y - p.y) < 26) {
        pilot.routeIndex += 1;
      } else {
        steer = cell;
        break;
      }
    }
    if (pilot.routeIndex >= pilot.route.length) steer = { x: goal.x, y: goal.y };
  }
  const speed = PLAYER.walkSpeed;
  let bestDir = DIRS[0];
  let bestScore = -Infinity;
  for (const [dx, dy] of DIRS) {
    const len = Math.hypot(dx, dy) || 1;
    // Can the thief actually step that way, or is a wall in the way? Probe in small
    // increments, like the real per-frame movement, so a wall corner the thief cannot
    // squeeze past blocks the probe too (one big jump would tunnel through it).
    const probe = { x: p.x, y: p.y };
    for (let k = 0; k < 4; k += 1) {
      moveCircle(world, probe, (dx / len) * speed * 0.05, (dy / len) * speed * 0.05, PLAYER.radius);
    }
    const moved = Math.hypot(probe.x - p.x, probe.y - p.y);
    if ((dx !== 0 || dy !== 0) && moved < 4) continue;
    const px = p.x + (dx / len) * speed * 0.25;
    const py = p.y + (dy / len) * speed * 0.25;
    const toSteer = Math.hypot(steer.x - px, steer.y - py);
    const danger = dangerAt(world, px, py);
    const score = -toSteer * 2 - danger * 320 - (dx === 0 && dy === 0 ? 6 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestDir = [dx, dy];
    }
  }
  const [bx, by] = bestDir;
  const blen = Math.hypot(bx, by) || 1;
  const sneak = dangerAt(world, p.x, p.y) > 0.15;
  return {
    mx: bx / blen,
    my: by / blen,
    sneak,
    grab: false,
    coinAt: null,
    empPressed: false,
  };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return
 * the screen to draw over it.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    const w = createWorld(2, 0);
    const pilot = { goalKey: null, route: [], routeIndex: 0 };
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      if (w.status !== 'playing') break;
      step(w, STEP, autopilot(w, pilot));
    }
    Object.assign(world, w);
    return { screen: w.status === 'playing' ? 'playing' : w.status, world: w };
  }
  if (name === 'end') {
    const w = createWorld(0, 0);
    const pilot = { goalKey: null, route: [], routeIndex: 0 };
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      if (w.status !== 'playing') break;
      step(w, STEP, autopilot(w, pilot));
    }
    Object.assign(world, w);
    return { screen: w.status === 'won' ? 'won' : w.status === 'levelDone' ? 'levelDone' : 'playing', world: w };
  }
  const w = createWorld(0, 0);
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    step(w, STEP, { mx: 0, my: 0, sneak: false, grab: false, coinAt: null, empPressed: false });
  }
  Object.assign(world, w);
  return { screen: 'title', world: w };
}
