// Velvet Vault — tuning constants. One job: every number the game balances on, in one
// place, so the world, the renderer and the screenshot autopilot all agree.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 64;
export const STEP = 1 / 60;

// The player: Vesper, the thief.
export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sneakSpeed: 96,
  grabReach: 44,
};

// Guards: patrol speed, chase speed, and how far and wide they can see.
export const GUARD = {
  radius: 13,
  patrolSpeed: 64,
  investigateSpeed: 98,
  chaseSpeed: 138,
  viewRange: 178,
  viewHalfAngle: 0.61,
  shadowRangeScale: 0.55,
  sneakRangeScale: 0.8,
  // Suspicion per second while the thief is in the cone (near end / far end).
  suspectNear: 62,
  suspectFar: 26,
  suspectDecay: 26,
  // Standing almost on top of a guard is suspicious even outside the cone.
  proximityRange: 52,
  proximityRate: 42,
  suspiciousAt: 55,
  chaseSeconds: 5,
  catchRange: 27,
};

// Wall cameras: they feed the alarm meter directly and never chase.
export const CAMERA = {
  range: 212,
  halfAngle: 0.5,
  alarmPerSecond: 17,
  empSeconds: 8,
};

// The alarm meter: 0 is calm, 100 is lockdown.
export const ALARM = {
  max: 100,
  decayPerSecond: 2.5,
  lockdownDecayPerSecond: 7,
  guardAlertAdd: 22,
  lockdownSeconds: 6,
  ghostCeiling: 40,
};

// Tools at a cost: a tossed coin and one EMP charge per room.
export const TOOLS = {
  coinRange: 260,
  coinFlightSeconds: 0.35,
  coinHearRange: 235,
  empRange: 340,
};

// Noise: sprinting is loud, sneaking is quiet.
export const NOISE = {
  runRadius: 95,
  runSuspicionPerSecond: 13,
  sneakRadius: 0,
};

export const SCORE = {
  ghostBonus: 500,
  timeBonusPerSecond: 12,
};
