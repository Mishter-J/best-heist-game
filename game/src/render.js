// Velvet Vault — everything the player sees: the gallery floor, the walls, the guards and
// their vision cones, the cameras, the loot, the thief, the HUD with its alarm meter, and
// the title, pause, busted and getaway screens. All drawing is plain canvas 2D, in the
// game's 1280x720 logical space; main.js scales it onto the real canvas.
import { ALARM, GUARD, HUD_H, VIEW_H, VIEW_W } from './config.js';
import { pointInShadow } from './world.js';

const GOLD = '#c9a227';
const GOLD_DIM = '#8a6d1f';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, halfAngle, range, color) {
  const grad = ctx.createRadialGradient(x, y, 10, x, y, range);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fill();
}

function drawFloor(ctx, world) {
  ctx.fillStyle = '#17142a';
  ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H);
  // Marble tiles: a faint checker across the playfield.
  ctx.fillStyle = '#1b1832';
  const tile = 64;
  for (let y = HUD_H; y < VIEW_H; y += tile) {
    for (let x = 0; x < VIEW_W; x += tile) {
      if (((x / tile) + (y / tile)) % 2 === 0) ctx.fillRect(x, y, tile, tile);
    }
  }
  // A faded red carpet runner down the middle of the gallery.
  ctx.fillStyle = 'rgba(122, 28, 48, 0.35)';
  ctx.fillRect(600, HUD_H, 80, VIEW_H - HUD_H);
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(604, HUD_H, 72, VIEW_H - HUD_H);
}

function drawShadows(ctx, world) {
  for (const s of world.level.shadows) {
    ctx.fillStyle = 'rgba(2, 2, 12, 0.55)';
    roundRect(ctx, s.x, s.y, s.w, s.h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140, 160, 255, 0.18)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawWalls(ctx, world) {
  for (const w of world.level.walls) {
    ctx.fillStyle = '#2c2745';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#3d3560';
    ctx.fillRect(w.x, w.y, w.w, 4);
    ctx.strokeStyle = GOLD_DIM;
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
  }
}

function drawExit(ctx, world) {
  const e = world.level.exit;
  const open = world.exitOpen;
  ctx.save();
  ctx.fillStyle = open ? 'rgba(46, 204, 113, 0.25)' : 'rgba(231, 76, 60, 0.16)';
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.strokeStyle = open ? '#2ecc71' : '#e74c3c';
  ctx.lineWidth = 3;
  ctx.strokeRect(e.x + 1.5, e.y + 1.5, e.w - 3, e.h - 3);
  ctx.fillStyle = open ? '#2ecc71' : '#e74c3c';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT' : 'LOCKED', e.x + e.w / 2, e.y + e.h / 2 - 2);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(open ? 'getaway →' : 'steal the prize', e.x + e.w / 2, e.y + e.h / 2 + 16);
  ctx.restore();
}

function drawLoot(ctx, world, time) {
  for (const item of world.loot) {
    if (item.taken) continue;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2 + item.x);
    if (item.kind === 'painting') {
      ctx.fillStyle = '#6b4f12';
      ctx.fillRect(item.x - 20, item.y - 14, 40, 28);
      ctx.fillStyle = '#7fb3d5';
      ctx.fillRect(item.x - 16, item.y - 10, 32, 20);
      ctx.fillStyle = '#e8c96a';
      ctx.beginPath();
      ctx.arc(item.x - 4, item.y - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e86c1';
      ctx.fillRect(item.x - 16, item.y + 4, 32, 6);
    } else {
      // Gem / target: a plinth, a glowing stone, and a sparkle.
      ctx.fillStyle = '#3a3358';
      ctx.beginPath();
      ctx.ellipse(item.x, item.y + 12, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a4266';
      ctx.fillRect(item.x - 12, item.y + 2, 24, 10);
      const big = item.kind === 'target';
      const r = big ? 15 : 10;
      const glow = big ? 0.55 + 0.3 * pulse : 0.3 + 0.15 * pulse;
      ctx.fillStyle = big ? `rgba(0, 229, 255, ${glow})` : `rgba(255, 215, 90, ${glow})`;
      ctx.beginPath();
      ctx.arc(item.x, item.y - 6, r + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = big ? '#00e5ff' : '#ffd75a';
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - 6 - r);
      ctx.lineTo(item.x + r * 0.8, item.y - 6);
      ctx.lineTo(item.x, item.y - 6 + r);
      ctx.lineTo(item.x - r * 0.8, item.y - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(item.x - r * 0.3, item.y - 6 - r * 0.35, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (big) {
        ctx.fillStyle = '#eafcff';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.name.toUpperCase(), item.x, item.y - 30);
      }
    }
    // Lifting progress ring while the thief holds E.
    if (item.grabT > 0) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 26, -Math.PI / 2, -Math.PI / 2 + (item.grabT / item.grabTime) * Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawGuards(ctx, world) {
  for (const guard of world.guards) {
    // Shadow under the guard, then the uniform, cap and facing tick.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(guard.x, guard.y + 10, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = guard.state === 'chase' ? '#8e2f2f' : '#2e4a7a';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#dfe8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#dfe8ff';
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * 18, guard.y + Math.sin(guard.angle) * 18);
    ctx.stroke();
    ctx.fillStyle = '#dfe8ff';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.angle) * 6, guard.y + Math.sin(guard.angle) * 6, 3, 0, Math.PI * 2);
    ctx.fill();
    // Suspicion arc over the head, "?" while investigating, "!" while chasing.
    if (guard.suspicion > 2) {
      ctx.strokeStyle = guard.suspicion > 55 ? '#ff5a3c' : '#ffd250';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 20, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
    if (guard.state === 'chase' || guard.state === 'investigate') {
      ctx.fillStyle = guard.state === 'chase' ? '#ff5a3c' : '#ffd250';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(guard.state === 'chase' ? '!' : '?', guard.x, guard.y - 26);
    }
  }
}

function drawCameras(ctx, world) {
  for (const camera of world.cameras) {
    const disabled = camera.disabledT > 0;
    if (!disabled) {
      drawCone(ctx, camera.x, camera.y, camera.angle, 0.5, 212, 'rgba(90, 220, 255, 0.16)');
    }
    ctx.fillStyle = disabled ? '#555' : '#223';
    ctx.strokeStyle = disabled ? '#777' : '#5adcff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = disabled ? '#999' : '#ff5a3c';
    ctx.beginPath();
    ctx.arc(camera.x + Math.cos(camera.angle) * 5, camera.y + Math.sin(camera.angle) * 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (disabled) {
      ctx.fillStyle = '#bbb';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`OFF ${Math.ceil(camera.disabledT)}s`, camera.x, camera.y - 14);
    }
  }
}

function drawCoin(ctx, world) {
  const coin = world.coin;
  if (!coin) return;
  const t = Math.min(1, coin.t);
  const x = coin.sx + (coin.tx - coin.sx) * t;
  const y = coin.sy + (coin.ty - coin.sy) * t - Math.sin(t * Math.PI) * 26;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff2b0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPlayer(ctx, world, time) {
  const p = world.player;
  const inShadow = pointInShadow(world, p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 11, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const r = p.sneaking ? 11 : 13;
  ctx.fillStyle = '#5b2d8e';
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d9b8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
  // Hood point and mask glint, facing the way the thief moves.
  ctx.fillStyle = '#2a1245';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.face) * 5, p.y + Math.sin(p.face) * 5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eaf6ff';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.face) * 9, p.y + Math.sin(p.face) * 9, 2, 0, Math.PI * 2);
  ctx.fill();
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(217, 184, 255, 0.6)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (inShadow) {
    ctx.fillStyle = 'rgba(180, 200, 255, 0.85)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('hidden', p.x, p.y - 20);
  }
}

function drawHud(ctx, world, view) {
  ctx.fillStyle = '#0d0b18';
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);

  // Left: room name and objective.
  ctx.fillStyle = '#f2e8c9';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(world.level.name, 18, 26);
  ctx.fillStyle = '#9a93b8';
  ctx.font = '13px system-ui, sans-serif';
  const objective = world.exitOpen
    ? 'Treasure secured — reach the green EXIT door!'
    : `Steal ${world.level.target.name} — then escape.`;
  ctx.fillText(objective, 18, 48);

  // Centre: the alarm meter.
  const meterX = 470;
  const meterW = 340;
  const meterY = 18;
  const frac = world.alarm / ALARM.max;
  const flashing = world.alarm > 70 && Math.floor(view.time * 4) % 2 === 0;
  ctx.fillStyle = flashing ? '#ff5a3c' : '#f2e8c9';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', meterX, meterY + 11);
  ctx.fillStyle = '#241f3a';
  roundRect(ctx, meterX + 62, meterY, meterW, 16, 8);
  ctx.fill();
  const alarmColor = frac < 0.4 ? '#2ecc71' : frac < 0.7 ? '#f39c12' : '#e74c3c';
  if (frac > 0.01) {
    ctx.fillStyle = alarmColor;
    roundRect(ctx, meterX + 64, meterY + 2, (meterW - 4) * frac, 12, 6);
    ctx.fill();
  }
  ctx.strokeStyle = '#5a5470';
  ctx.lineWidth = 1.5;
  roundRect(ctx, meterX + 62, meterY, meterW, 16, 8);
  ctx.stroke();
  ctx.fillStyle = '#9a93b8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`${Math.round(world.alarm)}%`, meterX + 62 + meterW + 10, meterY + 13);
  ctx.fillText(world.alarm >= ALARM.max ? 'LOCKDOWN!' : world.alarm > 70 ? 'HOT!' : world.alarm > 35 ? 'warm' : 'calm', meterX + 62, meterY + 34);

  // Right: loot, coins, EMP, time.
  ctx.textAlign = 'right';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`LOOT $${world.score}`, VIEW_W - 18, 26);
  ctx.fillStyle = '#9a93b8';
  ctx.font = '13px system-ui, sans-serif';
  const mm = Math.floor(world.time / 60);
  const ss = String(Math.floor(world.time % 60)).padStart(2, '0');
  ctx.fillText(`coins ${world.coins} · EMP ${world.emp} · ${mm}:${ss}`, VIEW_W - 18, 48);

  // "SPOTTED!" flash while a camera or a guard is watching the thief.
  const spotted = world.cameraSeeing || world.guards.some((g) => g.suspicion > 70);
  if (spotted && world.status === 'playing') {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPOTTED!', VIEW_W / 2, 112);
  }

  // Toast message (loot grabbed, target secured...).
  if (world.message) {
    ctx.fillStyle = 'rgba(13, 11, 24, 0.85)';
    const w = ctx.measureText(world.message).width + 28;
    roundRect(ctx, VIEW_W / 2 - w / 2, 128, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, VIEW_W / 2, 148);
  }
}

function drawWorld(ctx, world, view) {
  drawFloor(ctx, world);
  drawShadows(ctx, world);
  for (const guard of world.guards) {
    const suspicious = guard.suspicion > 55;
    const chasing = guard.state === 'chase';
    const color = chasing ? 'rgba(255, 60, 60, 0.30)' : suspicious ? 'rgba(255, 140, 40, 0.26)' : 'rgba(255, 210, 80, 0.20)';
    drawCone(ctx, guard.x, guard.y, guard.angle, 0.61, GUARD.viewRange, color);
  }
  for (const camera of world.cameras) {
    if (camera.disabledT <= 0) {
      drawCone(ctx, camera.x, camera.y, camera.angle, 0.5, 212, 'rgba(90, 220, 255, 0.16)');
    }
  }
  drawExit(ctx, world);
  drawLoot(ctx, world, view.time);
  drawWalls(ctx, world);
  drawCameras(ctx, world);
  drawCoin(ctx, world);
  drawGuards(ctx, world);
  drawPlayer(ctx, world, view.time);
  drawHud(ctx, world, view);
}

function overlay(ctx, title, lines, accent, hint) {
  ctx.fillStyle = 'rgba(8, 6, 16, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText(title, VIEW_W / 2, 220);
  ctx.fillStyle = '#f2e8c9';
  ctx.font = '18px Georgia, serif';
  let y = 280;
  for (const line of lines) {
    ctx.fillText(line, VIEW_W / 2, y);
    y += 30;
  }
  if (hint) {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(hint, VIEW_W / 2, y + 26);
  }
}

function drawTitle(ctx, view) {
  // The live gallery patrols behind the title, so the cover frame already shows the
  // room, its guards, cones, cameras, loot and alarm meter.
  drawWorld(ctx, view.world, view);
  ctx.fillStyle = 'rgba(8, 6, 16, 0.58)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 72px Georgia, serif';
  ctx.fillText('VELVET VAULT', VIEW_W / 2, 170);
  ctx.fillStyle = '#f2e8c9';
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('A stealth heist in three rooms', VIEW_W / 2, 212);
  ctx.font = '16px Georgia, serif';
  ctx.fillText('You are Vesper, a thief in the Meridian Gallery after dark.', VIEW_W / 2, 440);
  ctx.fillText('Read the patrols. Mind the cameras. Lift the treasure. Vanish.', VIEW_W / 2, 470);
  ctx.fillStyle = '#9a93b8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD move · SHIFT sneak · E lift loot · click toss a coin · Q EMP a camera · P pause · M mute', VIEW_W / 2, 540);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('Press ENTER or click to begin', VIEW_W / 2, 600);
  if (view.best > 0) {
    ctx.fillStyle = '#9a93b8';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Best getaway so far: $${view.best}`, VIEW_W / 2, 632);
  }
}

export function render(ctx, view) {
  const { screen, world } = view;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (screen === 'title') {
    drawTitle(ctx, view);
    return;
  }
  drawWorld(ctx, world, view);
  if (screen === 'paused') {
    overlay(ctx, 'PAUSED', ['The gallery waits. The guards do not.'], '#f2e8c9', 'Press P to resume');
  } else if (screen === 'busted') {
    overlay(ctx, 'BUSTED!', [
      'A guard caught Vesper red-handed.',
      `Loot kept: $${world.lootValue} · Best alarm: ${Math.round(world.maxAlarm)}%`,
    ], '#ff5a3c', 'Press ENTER to try the room again');
  } else if (screen === 'levelDone') {
    overlay(ctx, 'CLEAN LIFT', [
      `${world.level.target.name} secured.`,
      `Room loot $${world.lootValue} · time bonus $${Math.max(0, Math.round((world.level.parTime - world.time) * 12))}${world.ghost ? ' · GHOST bonus $500' : ''}`,
      `Total so far: $${world.score}`,
    ], GOLD, 'Press ENTER for the next room');
  } else if (screen === 'won') {
    overlay(ctx, 'CLEAN GETAWAY', [
      'The Aurora Diamond is yours. Vesper melts into the night.',
      `Final score: $${world.score}`,
      world.ghost ? 'Ghost run — never spotted in the final room. +$500' : 'The gallery never knew what hit it.',
    ], GOLD, 'Press ENTER to play again');
  }
}
