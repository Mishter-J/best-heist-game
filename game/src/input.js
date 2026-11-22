// Velvet Vault — keyboard and mouse input. One job: turn raw DOM events into the small
// input object the world steps on, with edge-triggered actions (coin toss, EMP) that fire
// exactly once per press.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    mx: 0,
    my: 0,
    sneak: false,
    grab: false,
    coinAt: null,
    empPressed: false,
    anyKey: false,
  };

  function updateMove() {
    let mx = 0;
    let my = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    const len = Math.hypot(mx, my);
    input.mx = len > 0 ? mx / len : 0;
    input.my = len > 0 ? my / len : 0;
    input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.grab = keys.has('KeyE');
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.code);
    input.anyKey = true;
    if (event.code === 'KeyQ') input.empPressed = true;
    updateMove();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    updateMove();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    updateMove();
  });

  // A click on the floor tosses a coin there (the world clamps the range). Clicks on the
  // canvas only; the menu screens use their own key/click handling in main.js.
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.coinAt = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });

  return input;
}

// Convert a canvas-pixel click into world coordinates for the 1280x720 logical view.
export function canvasToWorld(canvas, px, py) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((px - rect.left) / rect.width) * 1280,
    y: ((py - rect.top) / rect.height) * 720,
  };
}
