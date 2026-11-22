// Velvet Vault — the entry point: the game loop, the screens (title, playing, paused,
// busted, level done, won), the sound wiring, and the ?shot= scenes the screenshots
// are taken from. The world itself lives in world.js; this file only drives it.
import { createWorld, step } from './world.js';
import { createInput, canvasToWorld } from './input.js';
import { createAudio } from './audio.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { STEP, VIEW_H, VIEW_W } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const audio = createAudio();
const input = createInput(canvas);

let world = createWorld(0, 0);
let screen = 'title';
let best = 0;
try {
  best = Number(window.localStorage.getItem('velvet-vault-best') || 0) || 0;
} catch {
  best = 0;
}

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
let shotMode = false;
if (shotName) {
  shotMode = true;
  const staged = stageShot(shotName, world);
  world = staged.world;
  screen = staged.screen;
  if (screen === 'won' || screen === 'levelDone') best = Math.max(best, world.score);
}

function saveBest() {
  if (world.score > best) {
    best = world.score;
    try {
      window.localStorage.setItem('velvet-vault-best', String(best));
    } catch { /* storage unavailable; best score just is not kept */ }
  }
}

function playEventSounds(events) {
  for (const event of events) {
    if (event === 'step') audio.footstep(false);
    else if (event === 'stepQuiet') audio.footstep(true);
    else if (event === 'coin') audio.coin();
    else if (event === 'coinLand') audio.coinLand();
    else if (event === 'pickup') audio.pickup();
    else if (event === 'target') audio.target();
    else if (event === 'emp') audio.emp();
    else if (event === 'suspicious') audio.suspicious();
    else if (event === 'alert' || event === 'lockdown') audio.alert();
    else if (event === 'caught') audio.caught();
    else if (event === 'levelDone') audio.levelDone();
    else if (event === 'won') audio.win();
  }
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

function frame(now) {
  const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
  const ox = (canvas.width - VIEW_W * scale) / 2;
  const oy = (canvas.height - VIEW_H * scale) / 2;
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.fillStyle = '#0b0a12';
  ctx.fillRect(-ox / scale, -oy / scale, canvas.width / scale, canvas.height / scale);

  if (!shotMode && screen === 'playing') {
    const stepInput = {
      mx: input.mx,
      my: input.my,
      sneak: input.sneak,
      grab: input.grab,
      coinAt: null,
      empPressed: input.empPressed,
    };
    if (input.coinAt) {
      stepInput.coinAt = canvasToWorld(canvas, input.coinAt.x, input.coinAt.y);
      input.coinAt = null;
    }
    input.empPressed = false;
    step(world, STEP, stepInput);
    playEventSounds(world.events);
    audio.setSiren(world.alarm > 70);
    if (world.status === 'busted') {
      screen = 'busted';
      audio.setSiren(false);
      saveBest();
    } else if (world.status === 'levelDone') {
      screen = 'levelDone';
      audio.setSiren(false);
      saveBest();
    } else if (world.status === 'won') {
      screen = 'won';
      audio.setSiren(false);
      saveBest();
    }
  } else if (!shotMode && screen === 'title') {
    // Attract mode: the gallery patrols behind the title.
    step(world, STEP, { mx: 0, my: 0, sneak: false, grab: false, coinAt: null, empPressed: false });
  }

  render(ctx, { screen, world, best, time: world.time, muted: audio.isMuted() });
  if (statusEl) {
    statusEl.textContent = screen === 'playing'
      ? `${world.level.name}. Alarm ${Math.round(world.alarm)} percent. Loot $${world.score}.`
      : screen;
  }
  requestAnimationFrame(frame);
}

function startGame() {
  audio.unlock();
  if (screen === 'title') {
    world = createWorld(0, 0);
    screen = 'playing';
  } else if (screen === 'levelDone') {
    world = createWorld(world.levelIndex + 1, world.score);
    screen = 'playing';
  } else if (screen === 'busted') {
    world = createWorld(world.levelIndex, world.score - world.lootValue);
    screen = 'playing';
  } else if (screen === 'won') {
    world = createWorld(0, 0);
    screen = 'playing';
  }
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' || event.code === 'Space') {
    if (screen !== 'playing' && screen !== 'paused') {
      event.preventDefault();
      startGame();
    }
  }
  if (event.code === 'KeyP' && (screen === 'playing' || screen === 'paused')) {
    screen = screen === 'playing' ? 'paused' : 'playing';
  }
  if (event.code === 'KeyM') {
    audio.unlock();
    audio.setMuted(!audio.isMuted());
  }
});
canvas.addEventListener('pointerdown', () => {
  audio.unlock();
  if (screen !== 'playing' && screen !== 'paused') startGame();
});

// Exposed for play-testing and screenshots: the live world, screen and helpers.
window.__vv = {
  get world() { return world; },
  get screen() { return screen; },
  startGame,
  createWorld,
  step,
};

requestAnimationFrame(frame);
