// Velvet Vault — the three rooms of the Meridian Gallery. Each level is one fixed floor
// plan: walls the thief and the guards must walk around, shadow patches to hide in,
// guard patrols, sweeping cameras, loot with a price, and the one treasure that opens
// the getaway door. Nothing here is random: the same seed always plays the same room.
const WALL_TOP = { x: 0, y: 64, w: 1280, h: 16 };
const WALL_BOTTOM = { x: 0, y: 704, w: 1280, h: 16 };
const WALL_LEFT = { x: 0, y: 64, w: 16, h: 656 };
const WALL_RIGHT = { x: 1264, y: 64, w: 16, h: 656 };
const SHELL = [WALL_TOP, WALL_BOTTOM, WALL_LEFT, WALL_RIGHT];

export const LEVELS = [
  {
    name: 'Room 1 — The Marble Foyer',
    subtitle: 'Lift the Gilded Mask, then slip out the south door.',
    parTime: 75,
    playerStart: { x: 92, y: 640 },
    exit: { x: 1168, y: 620, w: 80, h: 84 },
    walls: [
      ...SHELL,
      { x: 420, y: 64, w: 16, h: 260 },
      { x: 860, y: 380, w: 16, h: 324 },
      { x: 560, y: 520, w: 240, h: 16 },
      { x: 200, y: 300, w: 140, h: 16 },
    ],
    shadows: [
      { x: 180, y: 480, w: 180, h: 120 },
      { x: 700, y: 600, w: 200, h: 88 },
      { x: 980, y: 120, w: 140, h: 90 },
    ],
    guards: [
      { waypoints: [[500, 150], [1000, 150]], pause: 1.6 },
      { waypoints: [[1080, 300], [1080, 620]], pause: 1.2 },
    ],
    cameras: [
      { x: 640, y: 82, baseAngle: Math.PI / 2, sweep: 0.7, speed: 0.45 },
    ],
    loot: [
      { x: 250, y: 140, kind: 'painting', value: 150, name: 'Portrait of a Lady', grabTime: 0.7 },
      { x: 700, y: 130, kind: 'gem', value: 200, name: 'Sapphire Brooch', grabTime: 0.6 },
      { x: 1150, y: 420, kind: 'painting', value: 120, name: 'Still Life, Pears', grabTime: 0.7 },
    ],
    target: { x: 950, y: 220, kind: 'target', value: 500, name: 'The Gilded Mask', grabTime: 1.2 },
    coins: 3,
    emp: 1,
  },
  {
    name: 'Room 2 — The Vault Corridor',
    subtitle: 'The Sunken Pearl waits behind two cameras. Mind the zigzag.',
    parTime: 95,
    playerStart: { x: 92, y: 640 },
    exit: { x: 1168, y: 620, w: 80, h: 84 },
    walls: [
      ...SHELL,
      { x: 300, y: 64, w: 16, h: 300 },
      { x: 640, y: 380, w: 16, h: 324 },
      { x: 980, y: 64, w: 16, h: 300 },
      { x: 480, y: 240, w: 220, h: 16 },
      { x: 820, y: 470, w: 220, h: 16 },
    ],
    shadows: [
      { x: 120, y: 300, w: 160, h: 110 },
      { x: 560, y: 580, w: 180, h: 90 },
      { x: 1000, y: 500, w: 160, h: 110 },
    ],
    guards: [
      { waypoints: [[360, 150], [900, 150]], pause: 1.4 },
      { waypoints: [[1100, 200], [1100, 600]], pause: 1.0 },
      { waypoints: [[200, 500], [560, 500]], pause: 1.3 },
    ],
    cameras: [
      { x: 480, y: 82, baseAngle: Math.PI / 2, sweep: 0.8, speed: 0.55 },
      { x: 1120, y: 696, baseAngle: -Math.PI / 2, sweep: 0.6, speed: 0.5 },
    ],
    loot: [
      { x: 180, y: 140, kind: 'painting', value: 180, name: 'The Duchess', grabTime: 0.7 },
      { x: 820, y: 150, kind: 'gem', value: 250, name: 'Emerald Pendant', grabTime: 0.6 },
      { x: 1150, y: 350, kind: 'painting', value: 150, name: 'Harbour at Dusk', grabTime: 0.7 },
      { x: 350, y: 620, kind: 'gem', value: 220, name: 'Ruby Cufflinks', grabTime: 0.6 },
    ],
    target: { x: 700, y: 300, kind: 'target', value: 600, name: 'The Sunken Pearl', grabTime: 1.2 },
    coins: 3,
    emp: 1,
  },
  {
    name: 'Room 3 — The Aurora Vault',
    subtitle: 'The Aurora Diamond. Three guards, two cameras, one way out.',
    parTime: 120,
    playerStart: { x: 92, y: 640 },
    exit: { x: 1168, y: 620, w: 80, h: 84 },
    walls: [
      ...SHELL,
      { x: 420, y: 64, w: 16, h: 360 },
      { x: 860, y: 300, w: 16, h: 404 },
      { x: 420, y: 300, w: 300, h: 16 },
      { x: 200, y: 520, w: 220, h: 16 },
      { x: 900, y: 520, w: 200, h: 16 },
    ],
    shadows: [
      { x: 90, y: 300, w: 150, h: 110 },
      { x: 1040, y: 300, w: 150, h: 110 },
      { x: 560, y: 600, w: 180, h: 88 },
    ],
    guards: [
      { waypoints: [[520, 180], [780, 180]], pause: 1.0 },
      { waypoints: [[150, 150], [150, 600]], pause: 1.2 },
      { waypoints: [[1130, 150], [1130, 600]], pause: 1.2 },
    ],
    cameras: [
      { x: 640, y: 82, baseAngle: Math.PI / 2, sweep: 0.9, speed: 0.7 },
      { x: 500, y: 696, baseAngle: -Math.PI / 2, sweep: 0.7, speed: 0.6 },
    ],
    loot: [
      { x: 250, y: 140, kind: 'painting', value: 200, name: 'The Countess', grabTime: 0.7 },
      { x: 1020, y: 140, kind: 'gem', value: 300, name: 'Opal Tiara', grabTime: 0.6 },
      { x: 1150, y: 450, kind: 'painting', value: 180, name: 'Winter Garden', grabTime: 0.7 },
      { x: 300, y: 620, kind: 'gem', value: 260, name: 'Topaz Signet', grabTime: 0.6 },
    ],
    target: { x: 640, y: 200, kind: 'target', value: 1000, name: 'The Aurora Diamond', grabTime: 1.4 },
    coins: 3,
    emp: 1,
  },
];
