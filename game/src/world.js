// Velvet Vault — the game itself: state, rules, guard AI, cameras, detection, the alarm
// meter, loot and win/lose. Pure logic: no DOM, no canvas, no audio calls of its own —
// it reports what happened as events and the caller plays the sounds. That also makes
// the world testable and deterministic: the same inputs always give the same world.
import { LEVELS } from './levels.js';
import {
  ALARM, CAMERA, GUARD, NOISE, PLAYER, SCORE, STEP, TOOLS,
} from './config.js';

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Does the segment (x1,y1)-(x2,y2) cross the rectangle? (Liang–Barsky slab test.)
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

export function lineOfSight(world, x1, y1, x2, y2) {
  for (const wall of world.level.walls) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  }
  return true;
}

export function pointInShadow(world, x, y) {
  for (const s of world.level.shadows) {
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  }
  return false;
}

function circleHitsWall(world, x, y, radius) {
  for (const wall of world.level.walls) {
    const cx = Math.max(wall.x, Math.min(x, wall.x + wall.w));
    const cy = Math.max(wall.y, Math.min(y, wall.y + wall.h));
    if (dist(x, y, cx, cy) < radius) return true;
  }
  return false;
}

// Move a circle through the walls, one axis at a time so it slides along them.
export function moveCircle(world, entity, dx, dy, radius) {
  const nx = entity.x + dx;
  if (!circleHitsWall(world, nx, entity.y, radius)) entity.x = nx;
  const ny = entity.y + dy;
  if (!circleHitsWall(world, entity.x, ny, radius)) entity.y = ny;
}

export function createWorld(levelIndex, totalScore) {
  const level = LEVELS[levelIndex];
  return {
    levelIndex,
    level,
    time: 0,
    status: 'playing',
    alarm: 0,
    maxAlarm: 0,
    lockdownT: 0,
    score: totalScore || 0,
    lootValue: 0,
    coins: level.coins,
    emp: level.emp,
    everSpotted: false,
    everSeenByCamera: false,
    cameraSeeing: false,
    grabbedCount: 0,
    message: null,
    messageT: 0,
    levelBonus: 0,
    ghost: false,
    player: {
      x: level.playerStart.x,
      y: level.playerStart.y,
      face: -Math.PI / 2,
      moving: false,
      sneaking: false,
      stepAcc: 0,
    },
    guards: level.guards.map((g) => ({
      x: g.waypoints[0][0],
      y: g.waypoints[0][1],
      waypoints: g.waypoints,
      wpIndex: 1 % g.waypoints.length,
      pause: g.pause,
      pauseT: 0,
      angle: 0,
      suspicion: 0,
      state: 'patrol',
      chaseT: 0,
      lookT: 0,
      lastSeenX: 0,
      lastSeenY: 0,
      investigateX: 0,
      investigateY: 0,
    })),
    cameras: level.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      baseAngle: c.baseAngle,
      sweep: c.sweep,
      speed: c.speed,
      angle: c.baseAngle,
      disabledT: 0,
    })),
    loot: [
      ...level.loot.map((l) => ({ ...l, taken: false, grabT: 0 })),
      { ...level.target, taken: false, grabT: 0 },
    ],
    coin: null,
    exitOpen: false,
    events: [],
  };
}

function guardSeesPlayer(world, guard) {
  const p = world.player;
  const d = dist(guard.x, guard.y, p.x, p.y);
  let range = GUARD.viewRange;
  if (pointInShadow(world, p.x, p.y)) range *= GUARD.shadowRangeScale;
  if (p.sneaking) range *= GUARD.sneakRangeScale;
  if (d > range) return { seen: false, d };
  const toPlayer = Math.atan2(p.y - guard.y, p.x - guard.x);
  if (Math.abs(angleDiff(toPlayer, guard.angle)) > GUARD.viewHalfAngle) return { seen: false, d };
  if (!lineOfSight(world, guard.x, guard.y, p.x, p.y)) return { seen: false, d };
  return { seen: true, d };
}

function cameraSeesPlayer(world, camera) {
  if (camera.disabledT > 0) return false;
  const p = world.player;
  const d = dist(camera.x, camera.y, p.x, p.y);
  if (d > CAMERA.range) return false;
  const toPlayer = Math.atan2(p.y - camera.y, p.x - camera.x);
  if (Math.abs(angleDiff(toPlayer, camera.angle)) > CAMERA.halfAngle) return false;
  if (!lineOfSight(world, camera.x, camera.y, p.x, p.y)) return false;
  return true;
}

// Is this point watched by any guard cone or camera cone right now? The screenshot
// autopilot uses it to steer clear of danger.
export function pointWatched(world, x, y) {
  for (const guard of world.guards) {
    const d = dist(guard.x, guard.y, x, y);
    if (d > GUARD.viewRange) continue;
    const toPoint = Math.atan2(y - guard.y, x - guard.x);
    if (Math.abs(angleDiff(toPoint, guard.angle)) > GUARD.viewHalfAngle) continue;
    if (lineOfSight(world, guard.x, guard.y, x, y)) return true;
  }
  for (const camera of world.cameras) {
    if (camera.disabledT > 0) continue;
    const d = dist(camera.x, camera.y, x, y);
    if (d > CAMERA.range) continue;
    const toPoint = Math.atan2(y - camera.y, x - camera.x);
    if (Math.abs(angleDiff(toPoint, camera.angle)) > CAMERA.halfAngle) continue;
    if (lineOfSight(world, camera.x, camera.y, x, y)) return true;
  }
  return false;
}

function stepGuard(world, guard, dt) {
  const p = world.player;
  const seen = guardSeesPlayer(world, guard);
  const inShadow = pointInShadow(world, p.x, p.y);

  // Suspicion rises while the thief is in the cone, faster up close, slower when the
  // thief sneaks or hides in shadow; it fades when the guard loses sight.
  if (seen.seen) {
    const near = 1 - Math.min(1, seen.d / GUARD.viewRange);
    let rate = GUARD.suspectFar + (GUARD.suspectNear - GUARD.suspectFar) * near;
    if (p.sneaking) rate *= 0.55;
    if (inShadow) rate *= 0.5;
    guard.suspicion = Math.min(100, guard.suspicion + rate * dt);
    guard.lastSeenX = p.x;
    guard.lastSeenY = p.y;
    if (guard.suspicion > GUARD.suspiciousAt) {
      world.everSpotted = true;
      if (guard.state !== 'chase') guard.state = 'investigate';
    }
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspectDecay * dt);
  }

  // Standing almost on top of a guard is suspicious even outside the cone.
  const pd = dist(guard.x, guard.y, p.x, p.y);
  if (pd < GUARD.proximityRange && guard.state !== 'chase') {
    guard.suspicion = Math.min(100, guard.suspicion + GUARD.proximityRate * dt);
    guard.lastSeenX = p.x;
    guard.lastSeenY = p.y;
  }

  // A sprinting thief is loud: nearby guards turn toward the noise.
  if (p.moving && !p.sneaking && pd < NOISE.runRadius && guard.state === 'patrol') {
    guard.suspicion = Math.min(100, guard.suspicion + NOISE.runSuspicionPerSecond * dt);
    guard.lastSeenX = p.x;
    guard.lastSeenY = p.y;
  }

  // Full suspicion: the guard raises the alarm and gives chase.
  if (guard.suspicion >= 100 && guard.state !== 'chase') {
    guard.state = 'chase';
    guard.chaseT = GUARD.chaseSeconds;
    world.alarm = Math.min(ALARM.max, world.alarm + ALARM.guardAlertAdd);
    world.events.push('alert');
  }

  if (guard.state === 'chase') {
    const d = dist(guard.x, guard.y, p.x, p.y);
    if (d < GUARD.catchRange) {
      world.status = 'busted';
      world.events.push('caught');
      return;
    }
    const tx = seen.seen ? p.x : guard.lastSeenX;
    const ty = seen.seen ? p.y : guard.lastSeenY;
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      guard.angle = Math.atan2(dy, dx);
      moveCircle(world, guard, (dx / len) * GUARD.chaseSpeed * dt, (dy / len) * GUARD.chaseSpeed * dt, GUARD.radius);
    }
    if (seen.seen) {
      guard.chaseT = GUARD.chaseSeconds;
    } else {
      guard.chaseT -= dt;
      if (guard.chaseT <= 0) {
        guard.state = 'patrol';
        guard.suspicion = 40;
      }
    }
    return;
  }

  if (guard.state === 'investigate') {
    const tx = guard.investigateX || guard.lastSeenX;
    const ty = guard.investigateY || guard.lastSeenY;
    const d = dist(guard.x, guard.y, tx, ty);
    if (d > 10) {
      const dx = tx - guard.x;
      const dy = ty - guard.y;
      const len = Math.hypot(dx, dy);
      guard.angle = Math.atan2(dy, dx);
      moveCircle(world, guard, (dx / len) * GUARD.investigateSpeed * dt, (dy / len) * GUARD.investigateSpeed * dt, GUARD.radius);
    } else {
      // Arrived: look around for a moment, then give up and go back on patrol.
      guard.lookT += dt;
      guard.angle += Math.sin(world.time * 1.4) * 0.03;
      if (guard.lookT > 1.6 || guard.suspicion < 30) {
        guard.state = 'patrol';
        guard.lookT = 0;
        guard.investigateX = 0;
        guard.investigateY = 0;
      }
    }
    return;
  }

  // Patrol: walk the waypoints, pausing at each one to look around.
  if (guard.pauseT > 0) {
    guard.pauseT -= dt;
    guard.angle += Math.sin(world.time * 0.9) * 0.02;
    return;
  }
  const wp = guard.waypoints[guard.wpIndex];
  const dx = wp[0] - guard.x;
  const dy = wp[1] - guard.y;
  const len = Math.hypot(dx, dy);
  if (len < 6) {
    guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
    guard.pauseT = guard.pause;
    return;
  }
  guard.angle = Math.atan2(dy, dx);
  moveCircle(world, guard, (dx / len) * GUARD.patrolSpeed * dt, (dy / len) * GUARD.patrolSpeed * dt, GUARD.radius);
}

export function step(world, dt, input) {
  if (world.status !== 'playing') return;
  world.time += dt;
  world.events.length = 0;
  const p = world.player;

  // --- The thief moves. ---
  const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  p.sneaking = input.sneak;
  p.moving = input.mx !== 0 || input.my !== 0;
  if (p.moving) {
    const nx = p.x + input.mx * speed * dt;
    const ny = p.y + input.my * speed * dt;
    moveCircle(world, p, nx - p.x, ny - p.y, PLAYER.radius);
    p.face = Math.atan2(input.my, input.mx);
    p.stepAcc += speed * dt;
    const stride = input.sneak ? 34 : 26;
    if (p.stepAcc > stride) {
      p.stepAcc = 0;
      world.events.push(input.sneak ? 'stepQuiet' : 'step');
    }
  }

  // --- Toss a coin: it flies, lands with a clink, and nearby guards investigate. ---
  if (input.coinAt && !world.coin && world.coins > 0) {
    const dx = input.coinAt.x - p.x;
    const dy = input.coinAt.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const range = Math.min(len, TOOLS.coinRange);
    world.coins -= 1;
    world.coin = {
      sx: p.x, sy: p.y,
      tx: p.x + (dx / len) * range,
      ty: p.y + (dy / len) * range,
      t: 0,
    };
    world.events.push('coin');
  }
  if (world.coin) {
    world.coin.t += dt / TOOLS.coinFlightSeconds;
    if (world.coin.t >= 1) {
      const { tx, ty } = world.coin;
      world.coin = null;
      world.events.push('coinLand');
      for (const guard of world.guards) {
        if (dist(guard.x, guard.y, tx, ty) < TOOLS.coinHearRange && guard.state !== 'chase') {
          guard.state = 'investigate';
          guard.investigateX = tx;
          guard.investigateY = ty;
          guard.lookT = 0;
        }
      }
    }
  }

  // --- EMP: knock out the nearest camera in range. ---
  if (input.empPressed && world.emp > 0) {
    let best = null;
    let bestD = TOOLS.empRange;
    for (const camera of world.cameras) {
      if (camera.disabledT > 0) continue;
      const d = dist(p.x, p.y, camera.x, camera.y);
      if (d < bestD) {
        best = camera;
        bestD = d;
      }
    }
    if (best) {
      world.emp -= 1;
      best.disabledT = CAMERA.empSeconds;
      world.events.push('emp');
    }
  }

  // --- Cameras sweep; a live camera watching the thief feeds the alarm. ---
  world.cameraSeeing = false;
  for (const camera of world.cameras) {
    if (camera.disabledT > 0) camera.disabledT -= dt;
    camera.angle = camera.baseAngle + Math.sin(world.time * camera.speed) * camera.sweep;
    if (cameraSeesPlayer(world, camera)) {
      world.cameraSeeing = true;
      world.everSeenByCamera = true;
      world.everSpotted = true;
      world.alarm = Math.min(ALARM.max, world.alarm + CAMERA.alarmPerSecond * dt);
    }
  }

  // --- Guards think and move. ---
  for (const guard of world.guards) {
    stepGuard(world, guard, dt);
    if (world.status !== 'playing') return;
    if (guard.suspicion > GUARD.suspiciousAt && guard.suspicion < 100 && guard.state === 'investigate') {
      if (world.events[world.events.length - 1] !== 'suspicious') world.events.push('suspicious');
    }
  }

  // --- The alarm cools when nobody is watching; at 100 the gallery locks down. ---
  const watched = world.cameraSeeing || world.guards.some((g) => g.suspicion > GUARD.suspiciousAt);
  if (world.alarm >= ALARM.max) {
    if (world.lockdownT <= 0) {
      world.lockdownT = ALARM.lockdownSeconds;
      for (const guard of world.guards) {
        if (guard.state !== 'chase') {
          guard.state = 'chase';
          guard.chaseT = ALARM.lockdownSeconds;
          guard.lastSeenX = p.x;
          guard.lastSeenY = p.y;
        }
      }
      world.events.push('lockdown');
    }
    world.lockdownT -= dt;
    if (world.lockdownT <= 0) {
      world.alarm = Math.max(0, world.alarm - ALARM.lockdownDecayPerSecond * dt);
    }
  } else if (!watched) {
    world.alarm = Math.max(0, world.alarm - ALARM.decayPerSecond * dt);
  }
  world.maxAlarm = Math.max(world.maxAlarm, world.alarm);

  // --- Lifting loot: hold E near it; the big prize takes longer. ---
  let nearest = null;
  let nearestD = PLAYER.grabReach;
  for (const item of world.loot) {
    if (item.taken) continue;
    const d = dist(p.x, p.y, item.x, item.y);
    if (d < nearestD) {
      nearest = item;
      nearestD = d;
    }
  }
  for (const item of world.loot) {
    if (item !== nearest) item.grabT = Math.max(0, item.grabT - dt * 2);
  }
  if (nearest && input.grab) {
    nearest.grabT += dt;
    if (nearest.grabT >= nearest.grabTime) {
      nearest.taken = true;
      nearest.grabT = 0;
      world.lootValue += nearest.value;
      world.score += nearest.value;
      world.grabbedCount += 1;
      world.message = `+$${nearest.value} — ${nearest.name}`;
      world.messageT = 2.2;
      if (nearest.kind === 'target') {
        world.exitOpen = true;
        world.events.push('target');
        world.message = `${nearest.name} secured — get to the getaway door!`;
        world.messageT = 3;
      } else {
        world.events.push('pickup');
      }
    }
  }

  // --- The getaway door: open once the room's treasure is lifted. ---
  if (world.exitOpen) {
    const e = world.level.exit;
    if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) {
      const timeBonus = Math.max(0, Math.round((world.level.parTime - world.time) * SCORE.timeBonusPerSecond));
      world.ghost = !world.everSpotted && world.maxAlarm <= ALARM.ghostCeiling;
      world.levelBonus = timeBonus + (world.ghost ? SCORE.ghostBonus : 0);
      world.score += world.levelBonus;
      if (world.levelIndex >= LEVELS.length - 1) {
        world.status = 'won';
        world.events.push('won');
      } else {
        world.status = 'levelDone';
        world.events.push('levelDone');
      }
      return;
    }
  }

  if (world.messageT > 0) world.messageT -= dt;
  if (world.messageT <= 0) world.message = null;
}

export { STEP };
